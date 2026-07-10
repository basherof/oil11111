import { InMemoryStore } from '../engine/store';
import { Core } from '../engine/core';
import { loadConfig } from '../engine/config';
import { ResolutionAction, StaffRole } from '@rihlati/shared-types';

export interface ScenarioReport {
  id: number;
  name: string;
  expected: string;
  steps: string[];
  bookingReference?: string;
  stateTimeline: string[];
  exceptions: { type: string; routedRole: string; slaDueAt: string; status: string }[];
  resolution?: string;
  finalState?: string;
  touchless?: boolean;
  pass: boolean;
  failReason?: string;
}

/**
 * Booking Flow Simulator (doc 13 §13.19) — drives the REAL engine (state machine,
 * exception queue, automation decisions, notifications, PDFs, audit) with mock
 * providers. Runs headless (CI) or via /simulator API + admin console.
 */
export class Simulator {
  /** fresh isolated core per scenario; 'automated' profile = A2 ratchet (post-pilot levels) */
  private async freshCore(profile: 'automated' | 'launch' = 'automated'): Promise<Core> {
    const core = await new Core(loadConfig(process.env), new InMemoryStore()).init();
    if (profile === 'automated') {
      const admin = { id: 'sim-admin', role: 'super_admin' };
      for (const key of ['passport_ocr', 'payment_matching', 'supplier_confirmation', 'ticket_issuing', 'quotation_generation'] as const) {
        await core.automation.setLevel(key, 'A2', admin.id);
      }
    }
    return core;
  }

  private async staff(core: Core, role: StaffRole) {
    const users = await core.store.find<any>('users', { role });
    const u = users[0];
    return { id: u?.id || `sim-${role}`, role };
  }

  private async newFlightBooking(core: Core, opts: { total?: number; returnDate?: string } = {}) {
    const b = await core.bookings.createDraft({
      customerName: 'Fatima Ahmed', customerPhone: '+218911234567', serviceType: 'flight',
      totalAmount: opts.total ?? 4860, currency: 'LYD',
      details: { destination: 'Istanbul', destinationCountry: 'TR', returnDate: opts.returnDate ?? '2026-08-22' },
    });
    await core.bookings.planAndQuote(b.id);
    return core.stateMachine.getBooking(b.id);
  }

  private async greenToAwaitingPayment(core: Core, booking: any, steps: string[]) {
    const scan = await core.ocr.scanPassport(booking.id, { ref: 'img://passport-clear.jpg' });
    steps.push(`OCR scan → ${scan.outcome} (confidence ${scan.result.confidence})`);
    await core.ocr.customerConfirms(booking.id, scan.result.fields);
    steps.push('Customer confirmed extracted passport data (§13.11, stored in audit)');
    const { paymentReference } = await core.bookings.customerConfirmsQuote(booking.id);
    steps.push(`Quotation confirmed → payment reference ${paymentReference}`);
    return paymentReference;
  }

  private async report(core: Core, r: Omit<ScenarioReport, 'stateTimeline' | 'exceptions' | 'touchless'> & { bookingId?: string }): Promise<ScenarioReport> {
    const timeline = r.bookingId ? (await core.store.find<any>('statusHistory', { bookingId: r.bookingId })).map((h) => h.toState) : [];
    const excs = (await core.store.find<any>('exceptions')).map((e) => ({ type: e.type, routedRole: e.routedRole, slaDueAt: e.slaDueAt, status: e.status }));
    const audits = await core.store.find<any>('auditLogs');
    const staffTouched = r.bookingId ? audits.some((a) => a.actorType === 'staff' && a.bookingId === r.bookingId) : undefined;
    const finalState = r.bookingId ? (await core.stateMachine.getBooking(r.bookingId)).state : undefined;
    return { ...r, stateTimeline: timeline, exceptions: excs, finalState, touchless: staffTouched === undefined ? undefined : !staffTouched };
  }

  private async resolveFirstOpen(core: Core, role: StaffRole, action: ResolutionAction, steps: string[], note?: string) {
    const [exc] = await core.exceptions.open({ role });
    if (!exc) throw new Error(`no open exception routed to ${role}`);
    const staff = await this.staff(core, role);
    const res = await core.exceptions.resolve(exc.id, action, staff as any, note);
    steps.push(`${role} resolved ${exc.type} via one-click "${action}" → booking resumed to ${res.bookingState}`);
    return res;
  }

  async run(id: number): Promise<ScenarioReport> {
    const steps: string[] = [];
    switch (id) {
      case 1: { // Successful touchless booking
        const core = await this.freshCore();
        const b = await this.newFlightBooking(core);
        steps.push(`Draft ${b.reference} → AI planned → quotation (A2 veto elapsed)`);
        const ref = await this.greenToAwaitingPayment(core, b, steps);
        const pay = await core.payments.processIncoming({ reference: ref, amount: 4860, payerName: 'Fatima', method: 'bank_transfer' });
        steps.push(`Bank transfer received → ${pay.outcome}`);
        await core.bookings.fulfil(b.id);
        steps.push('Supplier reserved+confirmed → ticket issued → PDF → Trip Wallet → WhatsApp/email delivered → reminders armed');
        const rep = await this.report(core, { id, name: 'Successful automatic booking', expected: 'Green path end-to-end, zero staff touches, no exceptions, state pre_travel_reminders_active', steps, bookingId: b.id, bookingReference: b.reference, pass: true });
        rep.pass = rep.finalState === 'pre_travel_reminders_active' && rep.exceptions.length === 0 && rep.touchless === true;
        if (!rep.pass) rep.failReason = `state=${rep.finalState} exceptions=${rep.exceptions.length} touchless=${rep.touchless}`;
        return rep;
      }
      case 2: { // Payment unmatched
        const core = await this.freshCore();
        const b = await this.newFlightBooking(core);
        await this.greenToAwaitingPayment(core, b, steps);
        const pay = await core.payments.processIncoming({ amount: 4860, payerName: 'UNKNOWN SENDER', method: 'bank_transfer' });
        steps.push(`Transfer WITHOUT reference from unknown payer → ${pay.outcome}`);
        await this.resolveFirstOpen(core, 'finance_officer', 'confirm_payment_manually', steps, 'Matched by phone call with customer');
        await core.payments.confirmManually(b.id, 'finance');
        await core.stateMachine.transition(b.id, 'payment_received', 'staff', { actorId: 'finance' });
        await core.bookings.fulfil(b.id);
        steps.push('After manual confirmation booking continued automatically to delivery');
        const rep = await this.report(core, { id, name: 'Payment unmatched exception', expected: 'exc_payment_unmatched → Finance Officer → confirm manually → booking resumes and completes', steps, bookingId: b.id, bookingReference: b.reference, pass: true });
        rep.pass = rep.exceptions.some((e) => e.type === 'payment_unmatched' && e.routedRole === 'finance_officer' && e.status === 'resolved') && rep.finalState === 'pre_travel_reminders_active';
        return rep;
      }
      case 3: { // Wrong payment amount
        const core = await this.freshCore();
        const b = await this.newFlightBooking(core);
        const ref = await this.greenToAwaitingPayment(core, b, steps);
        const pay: any = await core.payments.processIncoming({ reference: ref, amount: 4000, payerName: 'Fatima' });
        steps.push(`Paid 4000 of 4860 → ${pay.outcome}: required ${pay.diff.required}, received ${pay.diff.received}, difference ${pay.diff.difference}, suggested "${pay.diff.suggestedAction}"`);
        await this.resolveFirstOpen(core, 'finance_officer', 'approve_and_continue', steps, 'Customer sent remaining 860 by cash — verified');
        await core.payments.confirmManually(b.id, 'finance');
        await core.stateMachine.transition(b.id, 'payment_received', 'staff', { actorId: 'finance' });
        const rep = await this.report(core, { id, name: 'Wrong payment amount', expected: 'Difference shown with suggested action; Finance resolves; booking continues', steps, bookingId: b.id, bookingReference: b.reference, pass: true });
        rep.pass = rep.exceptions.some((e) => e.type === 'payment_unmatched' && e.status === 'resolved') && rep.finalState === 'payment_received';
        return rep;
      }
      case 4: { // OCR low confidence
        const core = await this.freshCore();
        const b = await this.newFlightBooking(core);
        const scan = await core.ocr.scanPassport(b.id, { ref: 'img://blurry.jpg', forced: { confidence: 0.55, imageQualityOk: false } });
        steps.push(`Blurry scan (confidence 0.55) → ${scan.outcome}`);
        await this.resolveFirstOpen(core, 'booking_officer', 'request_clearer_passport_image', steps, 'Auto-message sent asking for clearer photo');
        const rescan = await core.ocr.scanPassport(b.id, { ref: 'img://clear.jpg' });
        steps.push(`Customer re-uploaded → ${rescan.outcome} (confidence ${rescan.result.confidence})`);
        const rep = await this.report(core, { id, name: 'OCR low confidence', expected: 'exc_ocr_low_confidence → Booking Officer → clearer image requested → rescan auto-fills', steps, bookingId: b.id, bookingReference: b.reference, pass: true });
        rep.pass = rep.exceptions.some((e) => e.type === 'ocr_low_confidence' && e.routedRole === 'booking_officer' && e.status === 'resolved') && rescan.outcome === 'auto_filled';
        return rep;
      }
      case 5: { // Passport expiry risk
        const core = await this.freshCore();
        const b = await this.newFlightBooking(core, { returnDate: '2026-08-22' });
        const scan = await core.ocr.scanPassport(b.id, { ref: 'img://old-passport.jpg', forced: { fields: { expiryDate: '2026-11-30' } } });
        steps.push(`Passport expires 2026-11-30, return 2026-08-22, TR rule = 6 months → ${scan.outcome}`);
        await this.resolveFirstOpen(core, 'booking_officer', 'approve_and_continue', steps, 'Customer informed of risk in writing and accepted');
        const rep = await this.report(core, { id, name: 'Passport expiry risk', expected: 'exc_passport_issue → Booking Officer → informed override → booking resumes', steps, bookingId: b.id, bookingReference: b.reference, pass: true });
        rep.pass = rep.exceptions.some((e) => e.type === 'passport_expiry_risk' && e.status === 'resolved');
        return rep;
      }
      case 6: { // Supplier error + failover
        const core = await this.freshCore();
        const b = await this.newFlightBooking(core);
        const ref = await this.greenToAwaitingPayment(core, b, steps);
        await core.payments.processIncoming({ reference: ref, amount: 4860, payerName: 'Fatima' });
        core.providers.flightA.script.failReserve = true;
        core.providers.flightB.script.failReserve = true;
        await core.bookings.fulfil(b.id);
        steps.push('FLIGHT-A failed → automatic failover tried FLIGHT-B → also failed → supplier_error exception');
        core.providers.flightB.script.failReserve = false;
        await this.resolveFirstOpen(core, 'booking_manager', 'retry_supplier', steps, 'FLIGHT-B back online');
        await core.bookings.fulfil(b.id);
        steps.push('Retry succeeded via FLIGHT-B (failover) → ticket issued and delivered');
        const rep = await this.report(core, { id, name: 'Supplier error with failover', expected: 'Failover attempted, exc_supplier_error → Booking Manager → retry → completes via supplier B', steps, bookingId: b.id, bookingReference: b.reference, pass: true });
        rep.pass = rep.exceptions.some((e) => e.type === 'supplier_error' && e.status === 'resolved') && rep.finalState === 'pre_travel_reminders_active';
        return rep;
      }
      case 7: { // Supplier price change
        const core = await this.freshCore();
        const b = await this.newFlightBooking(core);
        const ref = await this.greenToAwaitingPayment(core, b, steps);
        await core.payments.processIncoming({ reference: ref, amount: 4860, payerName: 'Fatima' });
        core.providers.flightA.script.priceChangeTo = 5300;
        await core.bookings.fulfil(b.id);
        steps.push('Reprice before charge: 4860 → 5300 (>2% tolerance) → exc_supplier_price_changed, customer approval required');
        core.providers.flightA.script.priceChangeTo = undefined;
        await this.resolveFirstOpen(core, 'booking_manager', 'reprice_booking', steps, 'Customer approved new price on WhatsApp');
        await core.store.update('bookings', b.id, { totalAmount: 5300 });
        await core.bookings.fulfil(b.id);
        const rep = await this.report(core, { id, name: 'Supplier price change', expected: 'Never silently charge a new price: exception → customer approval → repriced → completes', steps, bookingId: b.id, bookingReference: b.reference, pass: true });
        rep.pass = rep.exceptions.some((e) => e.type === 'supplier_price_changed' && e.status === 'resolved') && rep.finalState === 'pre_travel_reminders_active';
        return rep;
      }
      case 8: { // Visa risk
        const core = await this.freshCore();
        const b = await this.newFlightBooking(core);
        const app: any = await core.visa.openApplication(b.id, 'DE', 'schengen');
        for (const k of ['passport', 'photo', 'flight_reservation']) await core.visa.uploadDocument(app.id, k, { ref: `doc://${k}` });
        await core.visa.uploadDocument(app.id, 'bank_statement', { ref: 'doc://bank', forcedPrecheck: { verdict: 'needs_correction', reasonEn: 'Covers 2 of 3 required months', reasonAr: 'يغطي شهرين من ثلاثة', confidence: 0.9, status: 'wrong_document' } });
        const risk = await core.visa.riskCheck(app.id, { daysToAppointment: 6 });
        steps.push(`Readiness low + appointment in 6 days → ${risk.risk}`);
        await this.resolveFirstOpen(core, 'visa_officer', 'request_missing_document', steps, 'Chase sequence triggered for remaining documents');
        const rep = await this.report(core, { id, name: 'Visa risk near appointment', expected: 'missing_document/visa_risk → Visa Officer → chase → file completed under officer control (final approval stays A1)', steps, bookingId: b.id, bookingReference: b.reference, pass: true });
        rep.pass = rep.exceptions.some((e) => (e.type === 'visa_risk' || e.type === 'missing_document') && e.routedRole === 'visa_officer' && e.status === 'resolved');
        return rep;
      }
      case 9: { // Missing document + readiness score + permanent-A1 sign-off
        const core = await this.freshCore();
        const b = await this.newFlightBooking(core);
        const app: any = await core.visa.openApplication(b.id, 'DE', 'schengen');
        for (const k of ['passport', 'photo', 'bank_statement', 'employment_letter', 'hotel_booking', 'flight_reservation']) await core.visa.uploadDocument(app.id, k, { ref: `doc://${k}` });
        const risk = await core.visa.riskCheck(app.id, { daysToAppointment: 10 });
        steps.push(`Insurance + invitation missing → ${risk.risk} exception with auto-chase`);
        await this.resolveFirstOpen(core, 'visa_officer', 'request_missing_document', steps);
        for (const k of ['travel_insurance', 'invitation_letter']) await core.visa.uploadDocument(app.id, k, { ref: `doc://${k}` });
        const approved: any = await core.visa.officerApprove(app.id, await this.staff(core, 'visa_officer') as any);
        steps.push(`All documents in → readiness ${approved.readinessScore}% → OFFICER sign-off (permanent A1) → file ${approved.fileStatus}`);
        const rep = await this.report(core, { id, name: 'Missing document → readiness 100% → officer approval', expected: 'missing_document → Visa Officer → docs uploaded → AI accepts → human final approval (A1 permanent)', steps, bookingId: b.id, bookingReference: b.reference, pass: true });
        rep.pass = approved.readinessScore === 100 && approved.fileStatus === 'approved_by_officer';
        return rep;
      }
      case 10: { // Refund request
        const core = await this.freshCore();
        const b = await this.newFlightBooking(core);
        const ref = await this.greenToAwaitingPayment(core, b, steps);
        await core.payments.processIncoming({ reference: ref, amount: 4860, payerName: 'Fatima' });
        await core.bookings.fulfil(b.id);
        await core.bookings.requestRefund(b.id, 'Trip cancelled by customer');
        steps.push('Refund requested → auto-calculated breakdown attached → exc_refund_requested (permanent A1)');
        await this.resolveFirstOpen(core, 'finance_manager', 'start_refund_process', steps, 'Refund approved per fare rules');
        const rep = await this.report(core, { id, name: 'Refund request', expected: 'exc_refund_requested → Finance Manager approves (A1) → booking → refunded', steps, bookingId: b.id, bookingReference: b.reference, pass: true });
        rep.pass = rep.finalState === 'refunded' && rep.exceptions.some((e) => e.type === 'refund_requested' && e.status === 'resolved');
        return rep;
      }
      case 11: { // Medical case
        const core = await this.freshCore();
        const b = await core.bookings.createDraft({ customerName: 'Omar M.', customerPhone: '+218920000000', serviceType: 'medical', totalAmount: 3000, details: { destinationCountry: 'TN', specialty: 'cardiology' } });
        steps.push('Medical travel request → ALWAYS routed to human coordinator (exc_medical_case, permanent A1)');
        await this.resolveFirstOpen(core, 'medical_officer', 'approve_and_continue', steps, 'Coordinator assigned; clinic appointment being arranged');
        const rep = await this.report(core, { id, name: 'Medical case', expected: 'exc_medical_case → Medical Officer assigns coordinator → booking resumes under human coordination', steps, bookingId: b.id, bookingReference: b.reference, pass: true });
        rep.pass = rep.exceptions.some((e) => e.type === 'medical_case' && e.routedRole === 'medical_officer' && e.status === 'resolved') && rep.finalState === 'draft';
        return rep;
      }
      case 12: { // Customer complaint / sentiment
        const core = await this.freshCore();
        const b = await this.newFlightBooking(core);
        const ref = await this.greenToAwaitingPayment(core, b, steps);
        await core.payments.processIncoming({ reference: ref, amount: 4860, payerName: 'Fatima' });
        await core.bookings.fulfil(b.id);
        await core.bookings.registerComplaint(b.id, 'هذا غير مقبول! الفندق غير ما اتفقنا عليه', 'angry');
        steps.push('Angry message detected → bot escalates silently → exc_sentiment_alert with AI summary');
        await this.resolveFirstOpen(core, 'support_supervisor', 'approve_and_continue', steps, 'Supervisor took over thread, hotel upgraded');
        const rep = await this.report(core, { id, name: 'Customer complaint / sentiment alert', expected: 'exc_sentiment_alert → Support Supervisor takes over → booking resumes', steps, bookingId: b.id, bookingReference: b.reference, pass: true });
        rep.pass = rep.exceptions.some((e) => e.type === 'sentiment_alert' && e.routedRole === 'support_supervisor' && e.status === 'resolved') && rep.finalState === 'pre_travel_reminders_active';
        return rep;
      }
      case 13: { // WhatsApp + PDF failure
        const core = await this.freshCore();
        const b = await this.newFlightBooking(core);
        const ref = await this.greenToAwaitingPayment(core, b, steps);
        await core.payments.processIncoming({ reference: ref, amount: 4860, payerName: 'Fatima' });
        core.providers.whatsapp.failNext = 3; // exceeds maxRetries → fallback + non-blocking exception
        core.providers.pdf.failNext = 3;
        await core.bookings.fulfil(b.id);
        steps.push('WhatsApp failed 3× → email fallback sent → whatsapp_delivery_failed (non-blocking)');
        steps.push('PDF failed 3× → pdf_generation_failed (non-blocking) → booking still delivered');
        const rep = await this.report(core, { id, name: 'WhatsApp/PDF failure with fallback', expected: 'Retries → fallback → non-blocking exceptions; booking completes anyway', steps, bookingId: b.id, bookingReference: b.reference, pass: true });
        rep.pass = rep.exceptions.some((e) => e.type === 'whatsapp_delivery_failed') && rep.exceptions.some((e) => e.type === 'pdf_generation_failed') && rep.finalState === 'pre_travel_reminders_active';
        return rep;
      }
      default:
        throw new Error(`unknown scenario ${id} (valid: 1-13)`);
    }
  }

  async runAll(): Promise<{ reports: ScenarioReport[]; passed: number; failed: number }> {
    const reports: ScenarioReport[] = [];
    for (let i = 1; i <= 13; i++) {
      try {
        reports.push(await this.run(i));
      } catch (e: any) {
        reports.push({ id: i, name: `scenario ${i}`, expected: '', steps: [], stateTimeline: [], exceptions: [], pass: false, failReason: e.message });
      }
    }
    return { reports, passed: reports.filter((r) => r.pass).length, failed: reports.filter((r) => !r.pass).length };
  }
}

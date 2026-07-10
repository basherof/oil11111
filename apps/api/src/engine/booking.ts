import { DataStore } from './store';
import { AuditService } from './audit';
import { AutomationService } from './automation';
import { ExceptionService } from './exceptions';
import { PaymentService } from './payments';
import { DocumentService } from './documents';
import { AiProvider, SupplierRegistry } from './providers';
import { Booking, StateMachine } from './state-machine';

let refSeq = 0;
const displayRef = () => `RHL-${(++refSeq).toString(36).toUpperCase().padStart(4, '0')}${Math.floor(Math.random() * 10)}`;

/**
 * Booking orchestrator — drives the green path (doc 13 §13.2) and supplier
 * fulfillment with failover (doc 13 §13.9–13.10). Every failure raises a typed exception.
 */
export class BookingService {
  constructor(
    private store: DataStore,
    private audit: AuditService,
    private automation: AutomationService,
    private exceptions: ExceptionService,
    private payments: PaymentService,
    private documents: DocumentService,
    private suppliers: SupplierRegistry,
    private ai: AiProvider,
    private sm: StateMachine,
  ) {}

  async createDraft(input: { customerId?: string; customerName: string; customerPhone: string; serviceType: Booking['serviceType']; totalAmount: number; currency?: string; channel?: string; details?: any }): Promise<Booking> {
    const booking = await this.store.insert<any>('bookings', {
      reference: displayRef(),
      customerId: input.customerId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      serviceType: input.serviceType,
      state: 'draft',
      totalAmount: input.totalAmount,
      currency: input.currency || 'LYD',
      channel: input.channel || 'simulator',
      details: input.details || {},
    });
    await this.audit.log({ actorType: 'customer', action: 'booking_draft_created', bookingId: booking.id, data: { serviceType: input.serviceType } });

    // Medical travel is ALWAYS human-coordinated (doc 13 §13.22)
    if (input.serviceType === 'medical') {
      await this.exceptions.raise('medical_case', booking.id, 'Medical travel request — human coordinator required (permanent A1)', { details: input.details }, ['approve_and_continue', 'escalate_to_manager']);
      return this.sm.getBooking(booking.id);
    }
    // High-value gate (doc 13 §13.22)
    const setting = await this.automation.get('quotation_generation');
    const ceiling = setting.params?.autoQuoteCeiling ?? 10000;
    if (input.totalAmount > ceiling) {
      await this.exceptions.raise('high_value_booking', booking.id, `Total ${input.totalAmount} ${booking.currency} exceeds auto ceiling ${ceiling} — manager approval required`, { ceiling }, ['approve_and_continue', 'reject_and_notify_customer']);
      return this.sm.getBooking(booking.id);
    }
    return booking;
  }

  /** AI plan + quotation (doc 13 §13.2 states 2–3), governed by A-levels. */
  async planAndQuote(bookingId: string): Promise<Booking> {
    let booking = await this.sm.getBooking(bookingId);
    const plan = await this.ai.planTrip(booking.details);
    await this.store.update('bookings', bookingId, { details: { ...booking.details, aiPlan: plan.options } });
    await this.audit.log({ actorType: 'ai', action: 'ai_trip_plan_generated', bookingId, confidence: plan.confidence });
    booking = await this.sm.transition(bookingId, 'ai_planned', 'system');

    const q = await this.ai.writeQuotation({ destination: booking.details?.destination, total: booking.totalAmount, currency: booking.currency });
    const decision = await this.automation.decide('quotation_generation', q.confidence, { entityType: 'booking', entityId: bookingId, bookingId });
    const quotation = await this.store.insert('quotations', { bookingId, bodyAr: q.bodyAr, bodyEn: q.bodyEn, total: booking.totalAmount, currency: booking.currency, status: decision === 'auto_continue' || decision === 'staff_veto_window' ? 'sent' : 'draft', decision });
    await this.audit.log({ actorType: 'ai', action: 'ai_quotation_generated', bookingId, confidence: q.confidence, result: decision, entityType: 'quotation', entityId: (quotation as any).id });
    booking = await this.sm.transition(bookingId, 'quotation_generated', 'system', { note: `quotation ${decision}` });
    return this.sm.transition(bookingId, 'awaiting_customer_confirmation', 'system');
  }

  /** Customer confirms → payment reference issued (doc 13 §13.2 state 5). */
  async customerConfirmsQuote(bookingId: string) {
    const booking = await this.sm.transition(bookingId, 'awaiting_payment', 'customer', { note: 'customer confirmed quotation and details' });
    const reference = await this.payments.createReference(bookingId);
    return { booking: await this.sm.getBooking(bookingId), paymentReference: reference };
  }

  /** Supplier confirmation with failover (doc 13 §13.9–13.10) + issue + documents + delivery. */
  async fulfil(bookingId: string): Promise<Booking> {
    let booking = await this.sm.getBooking(bookingId);
    booking = await this.sm.transition(bookingId, 'supplier_confirmation_pending', 'system');

    const category = booking.serviceType === 'hotel' ? 'hotel' : 'flight';
    const chain = this.suppliers.chain(category);
    if (!chain.length) throw new Error(`no supplier adapters for ${category}`);

    let supplierRef: string | undefined;
    let lastError = '';
    for (const adapter of chain) {
      // reprice before charge — price change beyond tolerance needs customer approval
      const rp = await adapter.reprice(`${adapter.code}-OFF-1`);
      if (rp.changed && Math.abs(rp.price - booking.totalAmount) / booking.totalAmount > 0.02) {
        await this.exceptions.raise('supplier_price_changed', bookingId, `Price changed ${booking.totalAmount} → ${rp.price} at ${adapter.code}; customer approval required`, { oldPrice: booking.totalAmount, newPrice: rp.price, supplier: adapter.code }, ['reprice_booking', 'send_updated_quotation', 'switch_supplier', 'cancel_booking']);
        return this.sm.getBooking(bookingId);
      }
      const res = await adapter.reserve(`${adapter.code}-OFF-1`, booking.passengers || []);
      if (res.ok) {
        supplierRef = res.supplierRef;
        await this.audit.log({ actorType: 'supplier', action: 'supplier_reserved', bookingId, data: { supplier: adapter.code, supplierRef } });
        break;
      }
      lastError = res.error || 'unknown';
      await this.audit.log({ actorType: 'supplier', action: 'supplier_failover', bookingId, data: { failed: adapter.code }, error: lastError });
    }
    if (!supplierRef) {
      await this.exceptions.raise('supplier_error', bookingId, `All suppliers failed for ${category}: ${lastError}`, { category, lastError, alternativesSearched: chain.map((c) => c.code) }, ['retry_supplier', 'switch_supplier', 'start_refund_process', 'cancel_booking']);
      return this.sm.getBooking(bookingId);
    }

    booking = await this.sm.transition(bookingId, 'confirmed', 'supplier', { note: `supplierRef ${supplierRef}` });
    booking = await this.sm.transition(bookingId, booking.serviceType === 'hotel' ? 'voucher_issued' : 'ticket_issued', 'system');

    const pdf = await this.documents.generatePdf(booking, booking.serviceType === 'hotel' ? 'hotel_voucher' : 'flight_ticket', 'ar', { supplierRef });
    booking = await this.sm.transition(bookingId, 'documents_generated', 'system', { note: pdf.ok ? 'pdf ok' : 'pdf failed — exception raised, delivery continues with retry' });

    await this.documents.addToWallet(bookingId, booking.serviceType === 'hotel' ? 'voucher' : 'ticket', { supplierRef, pdf: (pdf as any).artifact?.fileRef });
    booking = await this.sm.transition(bookingId, 'documents_delivered', 'system');
    return this.sm.transition(bookingId, 'pre_travel_reminders_active', 'system');
  }

  /** Refund request — always lands as a permanent-A1 exception (doc 13 §13.22). */
  async requestRefund(bookingId: string, reason: string) {
    return this.exceptions.raise('refund_requested', bookingId, `Customer requested refund: ${reason}`, { reason, autoCalculated: { farePenalty: 0.1, refundable: true } }, ['start_refund_process', 'reject_and_notify_customer', 'escalate_to_manager']);
  }

  /** Complaint / sentiment intake (doc 13 §13.13 escalation rules). */
  async registerComplaint(bookingId: string, text: string, sentiment: 'angry' | 'negative' | 'neutral' = 'negative') {
    const type = sentiment === 'angry' ? 'sentiment_alert' : 'customer_complaint';
    return this.exceptions.raise(type, bookingId, `Customer message flagged (${sentiment}): "${text}"`, { text, sentiment, aiSummary: `Customer unhappy: ${text.slice(0, 80)}` }, ['approve_and_continue', 'escalate_to_manager', 'start_refund_process']);
  }

  async list() {
    const rows = await this.store.find<Booking>('bookings');
    return rows.sort((a: any, b: any) => (a.createdAt < b.createdAt ? 1 : -1));
  }
}

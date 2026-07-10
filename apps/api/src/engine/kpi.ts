import { DataStore } from './store';

/** KPI tracking (doc 13 §13.17) — north star: Touchless Rate. Computed live from the store. */
export class KpiService {
  constructor(private store: DataStore) {}

  async snapshot() {
    const bookings = await this.store.find<any>('bookings');
    const exceptions = await this.store.find<any>('exceptions');
    const audits = await this.store.find<any>('auditLogs');
    const messages = await this.store.find<any>('messages');
    const decisions = await this.store.find<any>('automationDecisions');
    const refs = await this.store.find<any>('paymentReferences');
    const artifacts = await this.store.find<any>('artifacts');

    const delivered = bookings.filter((b) => ['documents_delivered', 'pre_travel_reminders_active', 'in_travel', 'completed', 'review_requested', 'closed'].includes(b.state));
    const staffTouched = new Set(audits.filter((a) => a.actorType === 'staff' && a.bookingId).map((a) => a.bookingId));
    const touchless = delivered.filter((b) => !staffTouched.has(b.id));

    const resolved = exceptions.filter((e) => e.status === 'resolved' && e.resolvedAt && e.createdAt);
    const avgResolutionMin = resolved.length
      ? Math.round(resolved.reduce((s, e) => s + (new Date(e.resolvedAt).getTime() - new Date(e.createdAt).getTime()) / 60000, 0) / resolved.length)
      : 0;

    const ocrDecisions = decisions.filter((d) => d.workflowKey === 'passport_ocr');
    const payMatched = refs.filter((r) => r.status === 'matched').length;
    const wa = messages.filter((m) => m.channel === 'whatsapp');
    const pdfAudits = audits.filter((a) => a.action === 'pdf_generated' || a.action === 'pdf_generation_failed');

    const byType: Record<string, number> = {};
    for (const e of exceptions) byType[e.type] = (byType[e.type] || 0) + 1;
    const topExceptionCauses = Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count }));

    return {
      generatedAt: new Date().toISOString(),
      bookings: { total: bookings.length, delivered: delivered.length },
      touchlessRate: delivered.length ? +(touchless.length / delivered.length).toFixed(2) : null,
      exceptionRate: bookings.length ? +(exceptions.length / bookings.length).toFixed(2) : 0,
      openExceptions: exceptions.filter((e) => ['open', 'in_progress', 'escalated'].includes(e.status)).length,
      avgExceptionResolutionMin: avgResolutionMin,
      ocr: {
        decisions: ocrDecisions.length,
        autoContinueRate: ocrDecisions.length ? +(ocrDecisions.filter((d) => d.decision === 'auto_continue').length / ocrDecisions.length).toFixed(2) : null,
        lowConfidenceRate: ocrDecisions.length ? +(ocrDecisions.filter((d) => d.decision === 'exception').length / ocrDecisions.length).toFixed(2) : null,
      },
      paymentMatchRate: refs.length ? +(payMatched / refs.length).toFixed(2) : null,
      whatsappDeliveryRate: wa.length ? +(wa.filter((m) => m.status === 'sent').length / wa.length).toFixed(2) : null,
      pdfSuccessRate: pdfAudits.length ? +(pdfAudits.filter((a) => a.action === 'pdf_generated').length / pdfAudits.length).toFixed(2) : null,
      artifacts: artifacts.length,
      topExceptionCauses,
    };
  }

  /** Weekly automation backlog (doc 13 §13.18): top exception causes = what to automate next. */
  async weeklyAutomationBacklog() {
    const snap = await this.snapshot();
    return { week: new Date().toISOString().slice(0, 10), topCauses: snap.topExceptionCauses.slice(0, 5), note: 'Top exception causes = next automation backlog items (doc 13 §13.18)' };
  }
}

import { DataStore } from './store';
import { AuditService } from './audit';
import { AutomationService } from './automation';
import { ExceptionService } from './exceptions';
import { StateMachine } from './state-machine';

export interface IncomingPayment {
  reference?: string;
  amount: number;
  currency?: string;
  payerName?: string;
  method?: string;
  receiptRef?: string;
  bankTxId?: string;
}

/**
 * Payment reference + auto-matching (doc 13 §13.8).
 * Unique reference TRV-YYYY-NNNNNN; matching by reference/amount/name with confidence;
 * wrong-amount handling with required/received/difference + suggested action.
 */
export class PaymentService {
  private seq = 0;
  constructor(private store: DataStore, private audit: AuditService, private automation: AutomationService, private exceptions: ExceptionService, private sm: StateMachine) {}

  async createReference(bookingId: string): Promise<string> {
    const booking = await this.sm.getBooking(bookingId);
    this.seq += 1;
    const reference = `TRV-${new Date().getFullYear()}-${String(this.seq).padStart(6, '0')}`;
    await this.store.insert('paymentReferences', { id: reference, reference, bookingId, expectedAmount: booking.totalAmount, currency: booking.currency, status: 'awaiting' });
    await this.store.update('bookings', bookingId, { paymentReference: reference });
    await this.audit.log({ actorType: 'system', action: 'payment_reference_created', bookingId, data: { reference, expectedAmount: booking.totalAmount } });
    return reference;
  }

  /** Confidence per doc 13 §13.5b: exact ref+amount high; partial signals medium; none low. */
  score(incoming: IncomingPayment, expected: { reference: string; expectedAmount: number; customerName: string }): number {
    let c = 0;
    if (incoming.reference && incoming.reference === expected.reference) c += 0.75;
    if (Math.abs(incoming.amount - expected.expectedAmount) < 0.01) c += 0.23;
    else if (incoming.amount > 0 && Math.abs(incoming.amount - expected.expectedAmount) / expected.expectedAmount < 0.15) c += 0.08;
    if (incoming.payerName && expected.customerName.toLowerCase().includes(incoming.payerName.toLowerCase().split(' ')[0] || '')) c += 0.1;
    if (incoming.bankTxId) c += 0.02;
    return Math.min(c, 0.99);
  }

  async processIncoming(incoming: IncomingPayment): Promise<{ outcome: string; bookingId?: string; exceptionId?: string; diff?: any }> {
    // find candidate reference
    const refs = await this.store.find<any>('paymentReferences', incoming.reference ? { reference: incoming.reference } : undefined);
    const candidate = refs.find((r) => r.status === 'awaiting' || r.status === 'partial');
    if (!candidate) {
      await this.audit.log({ actorType: 'system', action: 'payment_no_candidate', data: { incoming }, result: 'unmatched_orphan' });
      return { outcome: 'orphan_recorded' };
    }
    const booking = await this.sm.getBooking(candidate.bookingId);
    const payment = await this.store.insert<any>('payments', { bookingId: booking.id, ...incoming, status: 'pending' });

    // wrong amount → difference + suggested action (doc 13 §13.8)
    const diffVal = +(incoming.amount - candidate.expectedAmount).toFixed(2);
    if (Math.abs(diffVal) >= 0.01) {
      const suggested = diffVal < 0 ? 'request_remaining' : 'refund_extra';
      const diff = { required: candidate.expectedAmount, received: incoming.amount, difference: diffVal, suggestedAction: suggested };
      await this.store.update('paymentReferences', candidate.id, { status: diffVal < 0 ? 'partial' : 'overpaid', amountReceived: incoming.amount, difference: diffVal, suggestedAction: suggested });
      const exc = await this.exceptions.raise('payment_unmatched', booking.id, `Wrong amount: received ${incoming.amount}, required ${candidate.expectedAmount}`, { ...diff, paymentId: payment.id },
        ['confirm_payment_manually', 'approve_and_continue', 'reject_and_notify_customer', 'start_refund_process']);
      return { outcome: 'wrong_amount_exception', bookingId: booking.id, exceptionId: exc.id, diff };
    }

    const confidence = this.score(incoming, { reference: candidate.reference, expectedAmount: candidate.expectedAmount, customerName: booking.customerName });
    const decision = await this.automation.decide('payment_matching', confidence, { entityType: 'payment', entityId: payment.id, bookingId: booking.id });

    if (decision === 'auto_continue' || decision === 'staff_veto_window') {
      await this.store.update('payments', payment.id, { status: 'confirmed', confidence, decidedBy: 'system' });
      await this.store.update('paymentReferences', candidate.id, { status: 'matched', amountReceived: incoming.amount });
      await this.sm.transition(booking.id, 'payment_received', 'system', { note: `auto-matched (confidence ${confidence})${decision === 'staff_veto_window' ? ' after veto window' : ''}` });
      return { outcome: 'auto_matched', bookingId: booking.id };
    }
    if (decision === 'staff_approval' || decision === 'customer_confirm') {
      await this.store.update('payments', payment.id, { status: 'under_review', confidence });
      const exc = await this.exceptions.raise('payment_unmatched', booking.id, `Match confidence ${confidence} requires ${decision}`, { paymentId: payment.id, confidence }, ['confirm_payment_manually', 'reject_and_notify_customer']);
      return { outcome: 'pending_approval', bookingId: booking.id, exceptionId: exc.id };
    }
    const exc = await this.exceptions.raise('payment_unmatched', booking.id, `Low match confidence (${confidence})`, { paymentId: payment.id, confidence }, ['confirm_payment_manually', 'reject_and_notify_customer']);
    return { outcome: 'exception', bookingId: booking.id, exceptionId: exc.id };
  }

  /** Finance one-click: confirm manually (called via exception resolution flow). */
  async confirmManually(bookingId: string, staffId: string) {
    const refs = await this.store.find<any>('paymentReferences', { bookingId });
    for (const r of refs) await this.store.update('paymentReferences', r.id, { status: 'matched' });
    const pays = await this.store.find<any>('payments', { bookingId });
    for (const p of pays) if (p.status !== 'confirmed') await this.store.update('payments', p.id, { status: 'confirmed', decidedBy: staffId });
    await this.audit.log({ actorType: 'staff', actorId: staffId, action: 'payment_confirmed_manually', bookingId });
  }

  async board() {
    const refs = await this.store.find<any>('paymentReferences');
    return {
      waiting: refs.filter((r) => r.status === 'awaiting'),
      matched: refs.filter((r) => r.status === 'matched'),
      unmatched: refs.filter((r) => r.status === 'partial' || r.status === 'overpaid'),
    };
  }
}

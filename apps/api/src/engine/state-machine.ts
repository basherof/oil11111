import { ActorType, BookingState, EXCEPTION_STATES, GREEN_TRANSITIONS, TERMINAL_STATES } from '@rihlati/shared-types';
import { DataStore } from './store';
import { AuditService } from './audit';

export interface Booking {
  id: string;
  reference: string;          // display ref e.g. RHL-8K2M4
  paymentReference?: string;  // TRV-2026-000482
  customerName: string;
  customerPhone: string;
  serviceType: 'flight' | 'hotel' | 'package' | 'medical' | 'visa' | 'esim' | 'insurance' | 'transfer';
  state: BookingState;
  resumeState?: BookingState | null;
  totalAmount: number;
  currency: string;
  channel: string;
  details: any;
  passengers?: any[];
  createdAt?: string;
}

type TransitionListener = (booking: Booking, from: BookingState, to: BookingState) => Promise<void>;

const isException = (s: string) => (EXCEPTION_STATES as readonly string[]).includes(s);
const isTerminal = (s: string) => (TERMINAL_STATES as readonly string[]).includes(s);

/**
 * Booking State Machine — the heart of the platform (doc 13 §13.2).
 * - transitions only through this service, default actor = system
 * - green-path transitions validated against GREEN_TRANSITIONS
 * - exception states require a bound exception (enforced by ExceptionService which
 *   is the only caller of parkInException)
 * - every transition writes statusHistory + audit and notifies listeners
 *   (notifications, KPI, wallet hooks subscribe — nothing fails silently)
 */
export class StateMachine {
  private listeners: TransitionListener[] = [];

  constructor(private store: DataStore, private audit: AuditService) {}

  onTransition(l: TransitionListener) {
    this.listeners.push(l);
  }

  async getBooking(id: string): Promise<Booking> {
    const b = await this.store.get<Booking>('bookings', id);
    if (!b) throw new Error(`booking ${id} not found`);
    return b;
  }

  canTransition(from: BookingState, to: BookingState): boolean {
    if (isTerminal(from)) return false;
    if (isException(from)) return true; // resume handled by exception resolution
    if (isException(to)) return true;   // any active state may branch to an exception state
    return (GREEN_TRANSITIONS[from] || []).includes(to);
  }

  async transition(bookingId: string, to: BookingState, actorType: ActorType = 'system', opts: { actorId?: string; note?: string; data?: any } = {}): Promise<Booking> {
    const booking = await this.getBooking(bookingId);
    const from = booking.state;
    if (from === to) return booking;
    if (!this.canTransition(from, to)) {
      throw new Error(`Illegal transition ${from} -> ${to} for booking ${booking.reference}`);
    }
    const patch: Partial<Booking> = { state: to };
    if (isException(to) && !isException(from)) patch.resumeState = from;
    if (!isException(to)) patch.resumeState = null;
    const updated = await this.store.update<Booking>('bookings', bookingId, patch);
    await this.store.insert('statusHistory', { bookingId, fromState: from, toState: to, actorType, actorId: opts.actorId, note: opts.note });
    await this.audit.log({ actorType, actorId: opts.actorId, action: 'state_transition', bookingId, fromState: from, toState: to, data: opts.data, result: 'ok' });
    for (const l of this.listeners) await l(updated, from, to);
    return updated;
  }

  /** Only ExceptionService calls this — parks the booking in its typed exception state. */
  async parkInException(bookingId: string, excState: BookingState, actorType: ActorType = 'system', note?: string) {
    return this.transition(bookingId, excState, actorType, { note });
  }

  /** Resume after exception resolution: back to stored resume point (or an explicit override). */
  async resume(bookingId: string, actorType: ActorType, actorId: string, overrideState?: BookingState) {
    const booking = await this.getBooking(bookingId);
    if (!isException(booking.state)) throw new Error(`booking ${booking.reference} is not in an exception state`);
    const target = overrideState || booking.resumeState;
    if (!target) throw new Error(`booking ${booking.reference} has no resume state`);
    return this.transition(bookingId, target, actorType, { actorId, note: `resumed after exception (${booking.state})` });
  }

  /** Advance along the green path through several states, e.g. after payment. */
  async advance(bookingId: string, path: BookingState[], actorType: ActorType = 'system') {
    let b = await this.getBooking(bookingId);
    for (const s of path) b = await this.transition(b.id, s, actorType);
    return b;
  }
}

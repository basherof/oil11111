import { BookingState, EXCEPTION_TAXONOMY, ExceptionType, ResolutionAction, StaffRole } from '@rihlati/shared-types';
import { DataStore } from './store';
import { AuditService } from './audit';
import { StateMachine } from './state-machine';

export interface ExceptionRecord {
  id: string;
  type: ExceptionType;
  severity: string;
  bookingId: string;
  bookingReference: string;
  customerName: string;
  serviceType: string;
  routedRole: StaffRole;
  assignedTo?: string;
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'escalated';
  rootCause: string;
  context: any;               // auto-attached evidence
  suggestedActions: ResolutionAction[];
  slaDueAt: string;
  bookingStateAtCreation: string;
  nextStateAfterResolution?: string;
  internalNotes: { by: string; note: string; at: string }[];
  resolutionAction?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt?: string;
}

/**
 * Exception Queue (doc 13 §13.3) — the only staff work surface.
 * Typed, routed by role, SLA-timed; blocking exceptions park the booking in its
 * exc_ state; resolution resumes the state machine automatically.
 */
export class ExceptionService {
  constructor(private store: DataStore, private audit: AuditService, private sm: StateMachine) {}

  async raise(type: ExceptionType, bookingId: string, rootCause: string, context: any = {}, suggestedActions: ResolutionAction[] = ['approve_and_continue', 'escalate_to_manager']): Promise<ExceptionRecord> {
    const spec = EXCEPTION_TAXONOMY[type];
    const booking = await this.sm.getBooking(bookingId);
    const exc = await this.store.insert<any>('exceptions', {
      type,
      severity: spec.severity,
      bookingId,
      bookingReference: booking.reference,
      customerName: booking.customerName,
      serviceType: booking.serviceType,
      routedRole: spec.role,
      status: 'open',
      rootCause,
      context,
      suggestedActions,
      slaDueAt: new Date(Date.now() + spec.slaMinutes * 60_000).toISOString(),
      bookingStateAtCreation: booking.state,
      internalNotes: [],
    });
    if (spec.blocking && spec.bookingState) {
      await this.sm.parkInException(bookingId, spec.bookingState, 'system', `exception ${type}: ${rootCause}`);
      await this.store.update('exceptions', exc.id, { nextStateAfterResolution: booking.state });
    }
    await this.audit.log({ actorType: 'system', action: 'exception_created', bookingId, entityType: 'exception', entityId: exc.id, data: { type, rootCause }, result: spec.blocking ? 'booking_parked' : 'non_blocking' });
    return this.store.get('exceptions', exc.id) as any;
  }

  async open(filter: { role?: StaffRole; type?: ExceptionType } = {}) {
    let rows = await this.store.find<ExceptionRecord>('exceptions');
    rows = rows.filter((e) => e.status === 'open' || e.status === 'in_progress' || e.status === 'escalated');
    if (filter.role) rows = rows.filter((e) => e.routedRole === filter.role);
    if (filter.type) rows = rows.filter((e) => e.type === filter.type);
    return rows.sort((a, b) => (a.slaDueAt < b.slaDueAt ? -1 : 1));
  }

  async addNote(id: string, by: string, note: string) {
    const exc = await this.store.get<ExceptionRecord>('exceptions', id);
    if (!exc) throw new Error('exception not found');
    return this.store.update('exceptions', id, { internalNotes: [...exc.internalNotes, { by, note, at: new Date().toISOString() }] });
  }

  /**
   * One-click resolution (doc 13 §13.3). Role-checked by the HTTP layer.
   * Resolution resumes the state machine from the correct point.
   */
  async resolve(id: string, action: ResolutionAction, staff: { id: string; role: StaffRole }, note?: string): Promise<{ exception: ExceptionRecord; bookingState: BookingState }> {
    const exc = await this.store.get<ExceptionRecord>('exceptions', id);
    if (!exc) throw new Error('exception not found');
    if (exc.status === 'resolved') throw new Error('exception already resolved');
    if (staff.role !== 'super_admin' && staff.role !== exc.routedRole)
      throw new Error(`exception routed to ${exc.routedRole}; ${staff.role} cannot resolve it`);

    const booking = await this.sm.getBooking(exc.bookingId);
    let bookingState = booking.state;
    const spec = EXCEPTION_TAXONOMY[exc.type];

    if (spec.blocking) {
      if (action === 'cancel_booking') {
        bookingState = (await this.sm.resume(booking.id, 'staff', staff.id, 'cancelled')).state;
      } else if (action === 'start_refund_process' || action === 'reject_and_notify_customer') {
        bookingState = (await this.sm.resume(booking.id, 'staff', staff.id, exc.type.startsWith('refund') && action === 'start_refund_process' ? 'refunded' : 'cancelled')).state;
      } else {
        bookingState = (await this.sm.resume(booking.id, 'staff', staff.id)).state;
      }
    }
    const updated = await this.store.update<ExceptionRecord>('exceptions', id, {
      status: 'resolved',
      resolutionAction: action,
      resolvedBy: staff.id,
      resolvedAt: new Date().toISOString(),
      ...(note ? { internalNotes: [...exc.internalNotes, { by: staff.id, note, at: new Date().toISOString() }] } : {}),
    });
    await this.audit.log({ actorType: 'staff', actorId: staff.id, action: 'exception_resolved', bookingId: exc.bookingId, entityType: 'exception', entityId: id, data: { type: exc.type, action }, result: `booking:${bookingState}` });
    return { exception: updated, bookingState };
  }

  /** SLA sweep — escalate exceptions past 80% of their SLA (doc 12 §12.4). */
  async slaSweep() {
    const now = Date.now();
    const open = await this.open();
    const escalated: string[] = [];
    for (const e of open) {
      if (e.status === 'escalated') continue;
      const created = new Date(e.createdAt!).getTime();
      const due = new Date(e.slaDueAt).getTime();
      if (now > created + (due - created) * 0.8) {
        await this.store.update('exceptions', e.id, { status: 'escalated' });
        await this.audit.log({ actorType: 'system', action: 'exception_sla_escalated', bookingId: e.bookingId, entityType: 'exception', entityId: e.id });
        escalated.push(e.id);
      }
    }
    return escalated;
  }
}

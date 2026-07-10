import { ActorType } from '@rihlati/shared-types';
import { DataStore } from './store';

export interface AuditEntry {
  id?: string;
  actorType: ActorType;
  actorId?: string;
  action: string;
  bookingId?: string;
  entityType?: string;
  entityId?: string;
  fromState?: string;
  toState?: string;
  confidence?: number;
  data?: any;
  result?: string;
  error?: string;
  staffOverride?: boolean;
  at?: string;
}

/** Append-only audit log — every automated and manual action (doc 13 §13.16). */
export class AuditService {
  constructor(private store: DataStore) {}

  async log(entry: AuditEntry) {
    return this.store.insert('auditLogs', { at: new Date().toISOString(), ...entry });
  }
  async forBooking(bookingId: string) {
    const rows = await this.store.find<AuditEntry>('auditLogs', { bookingId });
    return rows.sort((a, b) => (a.at! < b.at! ? -1 : 1));
  }
  async recent(limit = 100) {
    const rows = await this.store.find<AuditEntry>('auditLogs');
    return rows.sort((a, b) => (a.at! > b.at! ? -1 : 1)).slice(0, limit);
  }
}

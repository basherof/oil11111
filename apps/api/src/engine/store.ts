import { randomUUID } from 'crypto';

/** Collections map 1:1 to Prisma models (prisma/schema.prisma). */
export type Collection =
  | 'users'
  | 'bookings'
  | 'statusHistory'
  | 'exceptions'
  | 'automationSettings'
  | 'automationDecisions'
  | 'payments'
  | 'paymentReferences'
  | 'customerConfirmations'
  | 'auditLogs'
  | 'walletItems'
  | 'messages'
  | 'artifacts'
  | 'visaApplications'
  | 'quotations'
  | 'kpiSnapshots';

export interface DataStore {
  readonly mode: 'memory' | 'postgres';
  insert<T = any>(col: Collection, row: Record<string, any>): Promise<T & { id: string }>;
  update<T = any>(col: Collection, id: string, patch: Record<string, any>): Promise<T>;
  get<T>(col: Collection, id: string): Promise<T | null>;
  find<T>(col: Collection, where?: Record<string, any>): Promise<T[]>;
  count(col: Collection, where?: Record<string, any>): Promise<number>;
  clear(): Promise<void>;
}

const matches = (row: any, where?: Record<string, any>) =>
  !where || Object.entries(where).every(([k, v]) => row[k] === v);

/** Default store — zero-setup mock mode. Postgres mode: see prisma-store.ts. */
export class InMemoryStore implements DataStore {
  readonly mode = 'memory' as const;
  private data = new Map<Collection, Map<string, any>>();

  private col(c: Collection) {
    if (!this.data.has(c)) this.data.set(c, new Map());
    return this.data.get(c)!;
  }
  async insert(c: Collection, row: any) {
    const id = row.id || randomUUID();
    const full = { createdAt: new Date().toISOString(), ...row, id };
    this.col(c).set(id, full);
    return full;
  }
  async update(c: Collection, id: string, patch: any) {
    const cur = this.col(c).get(id);
    if (!cur) throw new Error(`${c}/${id} not found`);
    const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    this.col(c).set(id, next);
    return next;
  }
  async get(c: Collection, id: string) {
    return this.col(c).get(id) ?? null;
  }
  async find(c: Collection, where?: Record<string, any>) {
    return [...this.col(c).values()].filter((r) => matches(r, where));
  }
  async count(c: Collection, where?: Record<string, any>) {
    return (await this.find(c, where)).length;
  }
  async clear() {
    this.data.clear();
  }
}

import { DataStore, Collection } from './store';
import { randomUUID } from 'crypto';

/**
 * PostgreSQL persistence via Prisma (experimental in v0.1 — memory mode is the tested path).
 * Requires: DATABASE_URL set, `npx prisma generate` + `npx prisma migrate deploy` run first.
 * Loaded lazily so the project compiles/runs in mock mode without the Prisma client generated.
 */
export class PrismaStore implements DataStore {
  readonly mode = 'postgres' as const;
  private prisma: any;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient } = require('@prisma/client');
    this.prisma = new PrismaClient();
  }
  private d(col: Collection) {
    const delegate = this.prisma[col.slice(0, 1).toLowerCase() + col.slice(1)];
    if (!delegate) throw new Error(`No prisma delegate for collection ${col}`);
    return delegate;
  }
  async insert(col: Collection, row: any) {
    return this.d(col).create({ data: { id: row.id || randomUUID(), ...row } });
  }
  async update(col: Collection, id: string, patch: any) {
    return this.d(col).update({ where: { id }, data: patch });
  }
  async get(col: Collection, id: string) {
    return this.d(col).findUnique({ where: { id } });
  }
  async find(col: Collection, where?: Record<string, any>) {
    return this.d(col).findMany({ where });
  }
  async count(col: Collection, where?: Record<string, any>) {
    return this.d(col).count({ where });
  }
  async clear() {
    throw new Error('clear() is not supported on the postgres store');
  }
}

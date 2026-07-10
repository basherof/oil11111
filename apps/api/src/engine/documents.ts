import { DataStore } from './store';
import { AuditService } from './audit';
import { AutomationService } from './automation';
import { ExceptionService } from './exceptions';
import { PdfProvider } from './providers';
import { Booking } from './state-machine';

/** PDF generation (doc 13 §13.14) + Trip Wallet (doc 13 §13.15). */
export class DocumentService {
  constructor(private store: DataStore, private audit: AuditService, private automation: AutomationService, private exceptions: ExceptionService, private pdf: PdfProvider) {}

  async generatePdf(booking: Booking, kind: string, locale: 'ar' | 'en' = 'ar', data: any = {}) {
    const setting = await this.automation.get('pdf_generation');
    if (setting.killSwitchActive) {
      await this.audit.log({ actorType: 'system', action: 'pdf_skipped_killswitch', bookingId: booking.id, data: { kind } });
      return { ok: false, skipped: true };
    }
    const maxRetries = setting.params?.maxRetries ?? 2;
    let last: { ok: boolean; fileRef?: string; error?: string } = { ok: false };
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      last = await this.pdf.render(kind, locale, { bookingReference: booking.reference, customerName: booking.customerName, ...data });
      if (last.ok) break;
    }
    if (!last.ok) {
      await this.audit.log({ actorType: 'system', action: 'pdf_generation_failed', bookingId: booking.id, data: { kind }, error: last.error });
      await this.exceptions.raise('pdf_generation_failed', booking.id, `PDF ${kind} failed after ${maxRetries + 1} attempts`, { kind, error: last.error });
      return { ok: false };
    }
    const artifact = await this.store.insert('artifacts', { bookingId: booking.id, kind: `pdf:${kind}`, locale, fileRef: last.fileRef, providerMode: this.pdf.mode });
    await this.audit.log({ actorType: 'system', action: 'pdf_generated', bookingId: booking.id, data: { kind, fileRef: last.fileRef }, result: 'ok' });
    return { ok: true, artifact };
  }

  /** Trip Wallet — one offline-capable place for all trip documents. */
  async addToWallet(bookingId: string, itemType: string, payload: any) {
    const item = await this.store.insert('walletItems', { bookingId, itemType, payload, offlineCached: true });
    await this.audit.log({ actorType: 'system', action: 'trip_wallet_item_added', bookingId, data: { itemType } });
    return item;
  }

  async wallet(bookingId: string) {
    return this.store.find('walletItems', { bookingId });
  }

  /** Completeness monitor (doc 12 §12.11): expected artifacts must exist before departure. */
  async walletCompleteness(bookingId: string, expected: string[] = ['ticket']) {
    const items = await this.store.find<any>('walletItems', { bookingId });
    const have = new Set(items.map((i) => i.itemType));
    return { complete: expected.every((e) => have.has(e)), missing: expected.filter((e) => !have.has(e)) };
  }
}

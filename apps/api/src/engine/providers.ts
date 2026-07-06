/**
 * Provider interfaces + mock implementations (doc 13 §13.6, §13.9, §13.12, §13.14; owner requirement §4).
 * Every provider reports its mode ('mock' | 'live') — surfaced on /health and the admin console.
 * Live adapters (Duffel, RateHawk, WhatsApp Cloud API, Claude, gateways) plug into these
 * interfaces in the supplier-integration milestone without changing the engine.
 */

// ---------- OCR (doc 13 §13.6) ----------
export interface OcrResult {
  fields: {
    fullName?: string; passportNumber?: string; nationality?: string; dateOfBirth?: string;
    gender?: string; issueDate?: string; expiryDate?: string; mrz?: string; countryCode?: string;
  };
  confidence: number;          // 0..1
  mrzChecksumOk: boolean;
  imageQualityOk: boolean;
  missingFields: string[];
}
export interface OcrProvider { mode: 'mock' | 'live'; extractPassport(image: { ref: string; forced?: Partial<OcrResult> }): Promise<OcrResult>; }

export class MockOcrProvider implements OcrProvider {
  mode = 'mock' as const;
  async extractPassport(image: { ref: string; forced?: Partial<OcrResult> }): Promise<OcrResult> {
    const base: OcrResult = {
      fields: {
        fullName: 'FATIMA AHMED', passportNumber: 'L0482913', nationality: 'LBY', dateOfBirth: '1990-03-12',
        gender: 'F', issueDate: '2020-01-15', expiryDate: '2030-01-14', countryCode: 'LBY',
        mrz: 'P<LBYAHMED<<FATIMA<<<<<<<<<<<<<<<<<<<<<<<<<<\nL0482913<2LBY9003125F3001141<<<<<<<<<<<<<<06',
      },
      confidence: 0.96, mrzChecksumOk: true, imageQualityOk: true, missingFields: [],
    };
    return { ...base, ...image.forced, fields: { ...base.fields, ...(image.forced?.fields || {}) } };
  }
}

// ---------- Messaging: WhatsApp + email (doc 13 §13.12) ----------
export interface SendResult { ok: boolean; providerMessageId?: string; error?: string; }
export interface MessagingProvider { mode: 'mock' | 'live'; channel: 'whatsapp' | 'email'; send(to: string, template: string, vars: Record<string, any>): Promise<SendResult>; }

export class MockWhatsAppProvider implements MessagingProvider {
  mode = 'mock' as const; channel = 'whatsapp' as const;
  failNext = 0; // simulator sets this to test retry/fallback
  async send(to: string, template: string): Promise<SendResult> {
    if (this.failNext > 0) { this.failNext--; return { ok: false, error: 'MOCK_WA_DELIVERY_FAILURE' }; }
    return { ok: true, providerMessageId: `wamid.MOCK.${Date.now()}` };
  }
}
export class MockEmailProvider implements MessagingProvider {
  mode = 'mock' as const; channel = 'email' as const;
  async send(): Promise<SendResult> { return { ok: true, providerMessageId: `email.MOCK.${Date.now()}` }; }
}

// ---------- PDF (doc 13 §13.14) ----------
export interface PdfProvider { mode: 'mock' | 'live'; render(kind: string, locale: 'ar' | 'en', data: any): Promise<{ ok: boolean; fileRef?: string; error?: string }>; }
export class MockPdfProvider implements PdfProvider {
  mode = 'mock' as const;
  failNext = 0;
  async render(kind: string, locale: 'ar' | 'en', data: any) {
    if (this.failNext > 0) { this.failNext--; return { ok: false, error: 'MOCK_PDF_RENDER_FAILURE' }; }
    return { ok: true, fileRef: `mock://pdfs/${kind}-${locale}-${data.bookingReference || 'doc'}-${Date.now()}.pdf` };
  }
}

// ---------- AI (planning, quotation text, document pre-check) ----------
export interface AiProvider {
  mode: 'mock' | 'live';
  planTrip(input: any): Promise<{ options: any[]; confidence: number }>;
  writeQuotation(input: any): Promise<{ bodyAr: string; bodyEn: string; confidence: number }>;
  precheckDocument(doc: { type: string; forced?: any }): Promise<{ verdict: 'pass' | 'needs_correction' | 'uncertain'; reasonAr?: string; reasonEn?: string; confidence: number }>;
}
export class MockAiProvider implements AiProvider {
  mode = 'mock' as const;
  async planTrip(input: any) {
    return {
      confidence: 0.9,
      options: ['economy', 'standard', 'premium'].map((tier, i) => ({
        tier, flightIdea: 'TIP→IST direct', hotelIdea: `${3 + i}★ near center`,
        estTotal: input.budget ? input.budget * (0.8 + i * 0.25) : 5900 + i * 1500, currency: 'LYD', estimated: true,
      })),
    };
  }
  async writeQuotation(input: any) {
    return {
      bodyAr: `عرض سعر رسمي — ${input.destination || 'الوجهة'} · الإجمالي ${input.total} ${input.currency} (صالح 48 ساعة)`,
      bodyEn: `Official quotation — ${input.destination || 'destination'} · total ${input.total} ${input.currency} (valid 48h)`,
      confidence: 0.92,
    };
  }
  async precheckDocument(doc: { type: string; forced?: any }) {
    return doc.forced || { verdict: 'pass' as const, confidence: 0.93 };
  }
}

// ---------- Supplier adapters (doc 13 §13.9–13.10) ----------
export interface SupplierOffer { offerId: string; price: number; currency: string; details: any; }
export interface SupplierAdapter {
  code: string;
  category: 'flight' | 'hotel' | 'esim' | 'insurance' | 'transfer' | 'visa' | 'medical' | 'tour';
  connectionMode: 'api' | 'portal' | 'manual';
  mode: 'mock' | 'live';
  search(criteria: any): Promise<SupplierOffer[]>;
  reprice(offerId: string): Promise<{ price: number; changed: boolean }>;
  reserve(offerId: string, pax: any[]): Promise<{ ok: boolean; supplierRef?: string; error?: string }>;
  confirm(supplierRef: string): Promise<{ ok: boolean; documents?: string[]; error?: string }>;
  cancel(supplierRef: string): Promise<{ ok: boolean }>;
  refundRequest(supplierRef: string): Promise<{ ok: boolean; amount?: number }>;
  statusCheck(supplierRef: string): Promise<{ status: string }>;
  documentRetrieval(supplierRef: string): Promise<{ documents: string[] }>;
}

/** Configurable mock supplier — the simulator scripts failures/price changes through `script`. */
export class MockSupplierAdapter implements SupplierAdapter {
  mode = 'mock' as const;
  connectionMode = 'api' as const;
  script: { failReserve?: boolean; priceChangeTo?: number } = {};
  constructor(public code: string, public category: SupplierAdapter['category'], private basePrice = 1240) {}
  async search(criteria: any): Promise<SupplierOffer[]> {
    return [{ offerId: `${this.code}-OFF-1`, price: criteria?.price ?? this.basePrice, currency: 'LYD', details: { supplier: this.code } }];
  }
  async reprice(offerId: string) {
    if (this.script.priceChangeTo) return { price: this.script.priceChangeTo, changed: true };
    return { price: this.basePrice, changed: false };
  }
  async reserve(offerId: string) {
    if (this.script.failReserve) return { ok: false, error: `MOCK_${this.code}_SOLD_OUT` };
    return { ok: true, supplierRef: `${this.code}-PNR-${Date.now()}` };
  }
  async confirm(supplierRef: string) { return { ok: true, documents: [`eticket:${supplierRef}`] }; }
  async cancel() { return { ok: true }; }
  async refundRequest() { return { ok: true, amount: this.basePrice }; }
  async statusCheck() { return { status: 'confirmed' }; }
  async documentRetrieval(supplierRef: string) { return { documents: [`eticket:${supplierRef}`] }; }
}

/** Registry with failover chains per category (doc 13 §13.10). */
export class SupplierRegistry {
  private chains = new Map<string, SupplierAdapter[]>();
  register(adapter: SupplierAdapter) {
    const chain = this.chains.get(adapter.category) || [];
    chain.push(adapter);
    this.chains.set(adapter.category, chain);
  }
  chain(category: string): SupplierAdapter[] {
    return this.chains.get(category) || [];
  }
}

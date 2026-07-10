/** Environment configuration (see .env.example and docs/14-activation-and-run-guide.md §B). */
export interface AppConfig {
  apiPort: number;
  appUrl: string;
  jwtSecret: string;
  databaseUrl?: string;
  persistence: 'memory' | 'postgres';
  pdfStoragePath: string;
  defaultAutomationLevel?: string;
  // feature enable flags (map to kill switches at boot)
  enableWhatsappAutomation: boolean;
  enablePaymentMatching: boolean;
  enableOcr: boolean;
  enablePdfGeneration: boolean;
  // provider modes: 'mock' unless a live key is configured
  providers: {
    whatsapp: 'mock' | 'live';
    ocr: 'mock' | 'live';
    payment: 'mock' | 'live';
    email: 'mock' | 'live';
    ai: 'mock' | 'live';
    flightSupplier: 'mock' | 'live';
    hotelSupplier: 'mock' | 'live';
    pdf: 'mock' | 'live';
  };
}

const flag = (v: string | undefined, dflt = true) =>
  v === undefined ? dflt : !['false', '0', 'no', 'off'].includes(v.toLowerCase());

export function loadConfig(env = process.env): AppConfig {
  const mode = (key: string): 'mock' | 'live' => (env[key] && env[key] !== 'mock' ? 'live' : 'mock');
  return {
    apiPort: parseInt(env.API_PORT || '3000', 10),
    appUrl: env.APP_URL || 'http://localhost:3000',
    jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me',
    databaseUrl: env.DATABASE_URL,
    persistence: env.PERSISTENCE === 'postgres' || (env.DATABASE_URL && env.PERSISTENCE !== 'memory') ? 'postgres' : 'memory',
    pdfStoragePath: env.PDF_STORAGE_PATH || './storage/pdfs',
    defaultAutomationLevel: env.DEFAULT_AUTOMATION_LEVEL,
    enableWhatsappAutomation: flag(env.ENABLE_WHATSAPP_AUTOMATION),
    enablePaymentMatching: flag(env.ENABLE_PAYMENT_MATCHING),
    enableOcr: flag(env.ENABLE_OCR),
    enablePdfGeneration: flag(env.ENABLE_PDF_GENERATION),
    providers: {
      whatsapp: mode('WHATSAPP_API_TOKEN'),
      ocr: mode('OCR_PROVIDER_API_KEY'),
      payment: mode('PAYMENT_PROVIDER_KEY'),
      email: mode('EMAIL_PROVIDER_KEY'),
      ai: mode('AI_PROVIDER_API_KEY'),
      flightSupplier: mode('FLIGHT_SUPPLIER_KEY'),
      hotelSupplier: mode('HOTEL_SUPPLIER_KEY'),
      pdf: 'mock', // live PDF rendering lands with the full dashboard milestone
    },
  };
}

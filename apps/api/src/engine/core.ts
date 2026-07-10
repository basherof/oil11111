import { createHash } from 'crypto';
import { StaffRole } from '@rihlati/shared-types';
import { AppConfig, loadConfig } from './config';
import { DataStore, InMemoryStore } from './store';
import { AuditService } from './audit';
import { AutomationService } from './automation';
import { StateMachine } from './state-machine';
import { ExceptionService } from './exceptions';
import { NotificationService } from './notifications';
import { PaymentService } from './payments';
import { OcrService } from './ocr';
import { VisaService } from './visa';
import { DocumentService } from './documents';
import { KpiService } from './kpi';
import { BookingService } from './booking';
import { SupportService } from './support';
import {
  MockAiProvider, MockEmailProvider, MockOcrProvider, MockPdfProvider,
  MockSupplierAdapter, MockWhatsAppProvider, SupplierRegistry,
} from './providers';

export const hashPassword = (pw: string) => createHash('sha256').update(`rihlati-test-salt:${pw}`).digest('hex');

export interface SeedUser { id?: string; email: string; password: string; name: string; role: StaffRole | 'customer' | 'agent' | 'corporate'; }

/** Test users (docs/14 §5). TEST CREDENTIALS ONLY — replace before any production use. */
export const SEED_USERS: SeedUser[] = [
  { email: 'admin@rihlati.test',    password: 'Admin@12345',    name: 'Salem Super Admin',   role: 'super_admin' },
  { email: 'finance@rihlati.test',  password: 'Finance@12345',  name: 'Huda Finance',        role: 'finance_officer' },
  { email: 'finmgr@rihlati.test',   password: 'FinMgr@12345',   name: 'Tarek Finance Mgr',   role: 'finance_manager' },
  { email: 'booking@rihlati.test',  password: 'Booking@12345',  name: 'Mona Booking',        role: 'booking_officer' },
  { email: 'bookmgr@rihlati.test',  password: 'BookMgr@12345',  name: 'Ali Booking Mgr',     role: 'booking_manager' },
  { email: 'visa@rihlati.test',     password: 'Visa@12345',     name: 'Aisha Visa Officer',  role: 'visa_officer' },
  { email: 'medical@rihlati.test',  password: 'Medical@12345',  name: 'Dr. Sami Medical',    role: 'medical_officer' },
  { email: 'support@rihlati.test',  password: 'Support@12345',  name: 'Nour Support Lead',   role: 'support_supervisor' },
  { email: 'agent1@rihlati.test',   password: 'Agent@12345',    name: 'Al-Safir Travel',     role: 'agent' },
  { email: 'corp1@rihlati.test',    password: 'Corp@12345',     name: 'Trading Co. Admin',   role: 'corporate' },
  { email: 'customer@rihlati.test', password: 'Customer@12345', name: 'Fatima Ahmed',        role: 'customer' },
];

/**
 * Composition root of the Smart Core. Framework-free: the Nest HTTP layer,
 * the simulator CLI, and future apps all consume this same engine.
 */
export class Core {
  config: AppConfig;
  store: DataStore;
  audit: AuditService;
  automation: AutomationService;
  stateMachine: StateMachine;
  exceptions: ExceptionService;
  notifications: NotificationService;
  payments: PaymentService;
  ocr: OcrService;
  visa: VisaService;
  documents: DocumentService;
  kpi: KpiService;
  bookings: BookingService;
  support: SupportService;
  suppliers: SupplierRegistry;
  providers: {
    whatsapp: MockWhatsAppProvider; email: MockEmailProvider; ocr: MockOcrProvider;
    pdf: MockPdfProvider; ai: MockAiProvider; flightA: MockSupplierAdapter;
    flightB: MockSupplierAdapter; hotelA: MockSupplierAdapter;
  };

  constructor(config?: AppConfig, store?: DataStore) {
    this.config = config || loadConfig();
    if (!store && this.config.persistence === 'postgres') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PrismaStore } = require('./prisma-store');
      store = new PrismaStore();
    }
    this.store = store || new InMemoryStore();

    this.audit = new AuditService(this.store);
    this.automation = new AutomationService(this.store, this.audit, this.config);
    this.stateMachine = new StateMachine(this.store, this.audit);
    this.exceptions = new ExceptionService(this.store, this.audit, this.stateMachine);

    this.providers = {
      whatsapp: new MockWhatsAppProvider(),
      email: new MockEmailProvider(),
      ocr: new MockOcrProvider(),
      pdf: new MockPdfProvider(),
      ai: new MockAiProvider(),
      flightA: new MockSupplierAdapter('FLIGHT-A', 'flight', 1240),
      flightB: new MockSupplierAdapter('FLIGHT-B', 'flight', 1330),
      hotelA: new MockSupplierAdapter('HOTEL-A', 'hotel', 900),
    };
    this.suppliers = new SupplierRegistry();
    this.suppliers.register(this.providers.flightA);
    this.suppliers.register(this.providers.flightB); // failover chain (doc 13 §13.10)
    this.suppliers.register(this.providers.hotelA);

    this.notifications = new NotificationService(this.store, this.audit, this.automation, this.exceptions, this.providers.whatsapp, this.providers.email);
    this.payments = new PaymentService(this.store, this.audit, this.automation, this.exceptions, this.stateMachine);
    this.ocr = new OcrService(this.store, this.audit, this.automation, this.exceptions, this.providers.ocr, this.stateMachine);
    this.visa = new VisaService(this.store, this.audit, this.automation, this.exceptions, this.providers.ai);
    this.documents = new DocumentService(this.store, this.audit, this.automation, this.exceptions, this.providers.pdf);
    this.kpi = new KpiService(this.store);
    this.bookings = new BookingService(this.store, this.audit, this.automation, this.exceptions, this.payments, this.documents, this.suppliers, this.providers.ai, this.stateMachine);
    this.support = new SupportService(this.store, this.audit, this.bookings, this.stateMachine);

    // every state change fires its WhatsApp template automatically (doc 13 §13.12)
    this.stateMachine.onTransition((b, from, to) => this.notifications.onStateChange(b, from, to));
  }

  async init() {
    await this.automation.seed();
    const existing = await this.store.count('users');
    if (existing === 0) {
      for (const u of SEED_USERS) {
        await this.store.insert('users', { email: u.email, passwordHash: hashPassword(u.password), name: u.name, role: u.role });
      }
    }
    return this;
  }

  health() {
    const p = this.providers;
    return {
      status: 'ok',
      persistence: this.store.mode,
      systemMode: Object.values(this.config.providers).every((m) => m === 'mock') ? 'MOCK' : 'MIXED',
      providers: {
        whatsapp: p.whatsapp.mode, email: p.email.mode, ocr: p.ocr.mode, pdf: p.pdf.mode, ai: p.ai.mode,
        suppliers: { 'FLIGHT-A': p.flightA.mode, 'FLIGHT-B': p.flightB.mode, 'HOTEL-A': p.hotelA.mode },
      },
    };
  }
}

let singleton: Core | null = null;
export async function getCore(): Promise<Core> {
  if (!singleton) singleton = await new Core().init();
  return singleton;
}

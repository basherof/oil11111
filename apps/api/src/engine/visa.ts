import { DataStore } from './store';
import { AuditService } from './audit';
import { AutomationService } from './automation';
import { ExceptionService } from './exceptions';
import { AiProvider } from './providers';

export type VisaDocStatus =
  | 'missing' | 'uploaded' | 'under_ai_precheck' | 'accepted_by_ai' | 'low_quality'
  | 'expired' | 'wrong_document' | 'needs_human_review' | 'approved_by_staff' | 'rejected';

export interface VisaChecklistItem { key: string; label: string; weight: number; hardFail: boolean; status: VisaDocStatus; reasonAr?: string; reasonEn?: string; }
export interface VisaApplication {
  id: string; bookingId: string; country: string; visaType: string;
  checklist: VisaChecklistItem[]; readinessScore: number;
  fileStatus: 'collecting' | 'ready_for_officer' | 'approved_by_officer' | 'submitted' | 'rejected';
  appointmentAt?: string;
}

const SCHENGEN_CHECKLIST: Omit<VisaChecklistItem, 'status'>[] = [
  { key: 'passport', label: 'Passport (6+ months validity)', weight: 20, hardFail: true },
  { key: 'photo', label: 'Personal photo (spec)', weight: 10, hardFail: true },
  { key: 'bank_statement', label: 'Bank statement (3 months)', weight: 15, hardFail: false },
  { key: 'employment_letter', label: 'Employment letter', weight: 10, hardFail: false },
  { key: 'hotel_booking', label: 'Hotel booking', weight: 10, hardFail: false },
  { key: 'flight_reservation', label: 'Flight reservation', weight: 10, hardFail: false },
  { key: 'travel_insurance', label: 'Travel insurance', weight: 15, hardFail: false },
  { key: 'invitation_letter', label: 'Invitation letter (if any)', weight: 10, hardFail: false },
];

/**
 * Visa Readiness Score + AI document pre-check (doc 13 §13.7).
 * AI pre-checks each upload; readiness = Σ accepted weights, hard-fail items cap the score.
 * Final file approval is PERMANENTLY A1 — visa_final_approval workflow is locked (doc 13 §13.22).
 */
export class VisaService {
  constructor(private store: DataStore, private audit: AuditService, private automation: AutomationService, private exceptions: ExceptionService, private ai: AiProvider) {}

  async openApplication(bookingId: string, country: string, visaType: string): Promise<VisaApplication> {
    const app = await this.store.insert<any>('visaApplications', {
      bookingId, country, visaType,
      checklist: SCHENGEN_CHECKLIST.map((c) => ({ ...c, status: 'missing' as VisaDocStatus })),
      readinessScore: 0, fileStatus: 'collecting',
    });
    await this.audit.log({ actorType: 'system', action: 'visa_application_opened', bookingId, entityType: 'visaApplication', entityId: app.id });
    return app;
  }

  computeScore(checklist: VisaChecklistItem[]): number {
    const total = checklist.reduce((s, c) => s + c.weight, 0);
    const ok = checklist.filter((c) => c.status === 'accepted_by_ai' || c.status === 'approved_by_staff');
    let score = Math.round((ok.reduce((s, c) => s + c.weight, 0) / total) * 100);
    const hardFailBroken = checklist.some((c) => c.hardFail && !['accepted_by_ai', 'approved_by_staff'].includes(c.status));
    if (hardFailBroken) score = Math.min(score, 60); // hard-fail items cap the score
    return score;
  }

  async uploadDocument(appId: string, key: string, doc: { ref: string; forcedPrecheck?: any }) {
    const app = await this.store.get<VisaApplication>('visaApplications', appId);
    if (!app) throw new Error('visa application not found');
    const item = app.checklist.find((c) => c.key === key);
    if (!item) throw new Error(`unknown checklist item ${key}`);
    item.status = 'under_ai_precheck';

    const pre = await this.ai.precheckDocument({ type: key, forced: doc.forcedPrecheck });
    // decision recorded for audit/thresholds; item acceptance is confidence-based —
    // AI accepts documents, only the FILE approval is the permanent-A1 gate (doc 13 §13.7)
    await this.automation.decide('visa_precheck', pre.confidence, { entityType: 'visaApplication', entityId: appId, bookingId: app.bookingId });
    const setting = await this.automation.get('visa_precheck');

    if (pre.verdict === 'pass' && pre.confidence >= setting.thresholds.high && !setting.killSwitchActive) item.status = 'accepted_by_ai';
    else if (pre.verdict === 'needs_correction') { item.status = (doc.forcedPrecheck?.status as VisaDocStatus) || 'low_quality'; item.reasonAr = pre.reasonAr; item.reasonEn = pre.reasonEn; }
    else item.status = 'needs_human_review';

    const readinessScore = this.computeScore(app.checklist);
    await this.store.update('visaApplications', appId, { checklist: app.checklist, readinessScore });
    await this.audit.log({ actorType: 'ai', action: 'visa_doc_prechecked', bookingId: app.bookingId, entityType: 'visaApplication', entityId: appId, confidence: pre.confidence, data: { key, verdict: pre.verdict, status: item.status, readinessScore } });
    return { item, readinessScore };
  }

  /** Risk sweep: near appointment with low score / missing items → visa_risk or missing_document exception. */
  async riskCheck(appId: string, opts: { daysToAppointment?: number; scoreThreshold?: number } = {}) {
    const app = await this.store.get<VisaApplication>('visaApplications', appId);
    if (!app) throw new Error('visa application not found');
    const threshold = opts.scoreThreshold ?? 80;
    const missing = app.checklist.filter((c) => c.status === 'missing');
    if (missing.length > 0) {
      const exc = await this.exceptions.raise('missing_document', app.bookingId, `Missing: ${missing.map((m) => m.key).join(', ')} (readiness ${app.readinessScore}%)`, { appId, missing: missing.map((m) => m.key) }, ['request_missing_document', 'approve_and_continue']);
      return { risk: 'missing_document', exceptionId: exc.id };
    }
    if (app.readinessScore < threshold && (opts.daysToAppointment ?? 99) <= 7) {
      const exc = await this.exceptions.raise('visa_risk', app.bookingId, `Readiness ${app.readinessScore}% < ${threshold}% with appointment in ${opts.daysToAppointment} days`, { appId, score: app.readinessScore }, ['approve_and_continue', 'escalate_to_manager']);
      return { risk: 'visa_risk', exceptionId: exc.id };
    }
    return { risk: 'none' };
  }

  /** Officer sign-off — the permanent-A1 gate. */
  async officerApprove(appId: string, staff: { id: string; role: string }) {
    if (!['visa_officer', 'super_admin'].includes(staff.role)) throw new Error('only a visa officer can approve a visa file');
    const app = await this.store.get<VisaApplication>('visaApplications', appId);
    if (!app) throw new Error('visa application not found');
    for (const c of app.checklist) if (c.status === 'accepted_by_ai') c.status = 'approved_by_staff';
    await this.store.update('visaApplications', appId, { checklist: app.checklist, fileStatus: 'approved_by_officer', readinessScore: this.computeScore(app.checklist) });
    await this.audit.log({ actorType: 'staff', actorId: staff.id, action: 'visa_file_approved', bookingId: app.bookingId, entityType: 'visaApplication', entityId: appId });
    return this.store.get('visaApplications', appId);
  }
}

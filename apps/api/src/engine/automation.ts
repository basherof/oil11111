import {
  AutomationDecision,
  AutomationLevel,
  AutomationSetting,
  DEFAULT_AUTOMATION_SETTINGS,
  WorkflowKey,
} from '@rihlati/shared-types';
import { DataStore } from './store';
import { AuditService } from './audit';
import { AppConfig } from './config';

/**
 * Automation governance (doc 13 §13.4, §13.5, §13.5b):
 * per-workflow A0–A3 levels, permanent-A1 locks, confidence thresholds, kill switches.
 * All changes are runtime (no redeploy) and audited.
 */
export class AutomationService {
  constructor(private store: DataStore, private audit: AuditService, private config: AppConfig) {}

  async seed() {
    const existing = await this.store.count('automationSettings');
    if (existing > 0) return;
    for (const s of DEFAULT_AUTOMATION_SETTINGS) {
      const setting: AutomationSetting = { ...s, killSwitchActive: false };
      // env ENABLE_* flags act as boot-time kill switches
      if (s.workflowKey === 'whatsapp_messages' && !this.config.enableWhatsappAutomation) setting.killSwitchActive = true;
      if (s.workflowKey === 'payment_matching' && !this.config.enablePaymentMatching) setting.killSwitchActive = true;
      if (s.workflowKey === 'passport_ocr' && !this.config.enableOcr) setting.killSwitchActive = true;
      if (s.workflowKey === 'pdf_generation' && !this.config.enablePdfGeneration) setting.killSwitchActive = true;
      await this.store.insert('automationSettings', { id: s.workflowKey, ...setting });
    }
  }

  async all(): Promise<AutomationSetting[]> {
    return this.store.find('automationSettings');
  }

  async get(key: WorkflowKey): Promise<AutomationSetting> {
    const s = await this.store.get<AutomationSetting>('automationSettings', key);
    if (!s) throw new Error(`Unknown workflow ${key}`);
    return s;
  }

  async setLevel(key: WorkflowKey, level: AutomationLevel, staffId: string) {
    const s = await this.get(key);
    if (s.permanentA1 && level !== 'A1' && level !== 'A0')
      throw new Error(`${key} is locked at A1 (permanent human approval — doc 13 §13.22)`);
    await this.store.update('automationSettings', key, { level });
    await this.audit.log({ actorType: 'staff', actorId: staffId, action: 'automation_level_changed', entityType: 'workflow', entityId: key, data: { from: s.level, to: level } });
    return this.get(key);
  }

  async setThresholds(key: WorkflowKey, thresholds: { high: number; medium: number }, staffId: string) {
    await this.get(key);
    await this.store.update('automationSettings', key, { thresholds });
    await this.audit.log({ actorType: 'staff', actorId: staffId, action: 'thresholds_changed', entityType: 'workflow', entityId: key, data: thresholds });
    return this.get(key);
  }

  async setKillSwitch(key: WorkflowKey, active: boolean, reason: string, staffId: string) {
    await this.get(key);
    await this.store.update('automationSettings', key, { killSwitchActive: active, killSwitchReason: reason });
    await this.audit.log({ actorType: 'staff', actorId: staffId, action: active ? 'kill_switch_activated' : 'kill_switch_deactivated', entityType: 'workflow', entityId: key, data: { reason } });
    return this.get(key);
  }

  /**
   * Core decision function (doc 13 §13.5b): given a workflow + confidence,
   * decide auto_continue / customer_confirm / staff_veto_window / staff_approval / exception.
   * Kill switch or A0 always degrades to staff_approval. Records automation_decisions
   * with the thresholds that applied at decision time (audit reproducibility).
   */
  async decide(key: WorkflowKey, confidence: number, ctx: { entityType?: string; entityId?: string; bookingId?: string } = {}): Promise<AutomationDecision> {
    const s = await this.get(key);
    let decision: AutomationDecision;
    if (s.killSwitchActive || s.level === 'A0') decision = 'staff_approval';
    else if (confidence < s.thresholds.medium) decision = 'exception';
    else if (confidence < s.thresholds.high) decision = s.level === 'A3' ? 'customer_confirm' : 'staff_approval';
    else decision = s.level === 'A1' ? 'staff_approval' : s.level === 'A2' ? 'staff_veto_window' : 'auto_continue';

    await this.store.insert('automationDecisions', {
      workflowKey: key, decision, confidence,
      thresholdHigh: s.thresholds.high, thresholdMedium: s.thresholds.medium,
      level: s.level, killSwitch: s.killSwitchActive, ...ctx,
    });
    await this.audit.log({ actorType: 'system', action: `automation_decision:${key}`, bookingId: ctx.bookingId, confidence, result: decision });
    return decision;
  }
}

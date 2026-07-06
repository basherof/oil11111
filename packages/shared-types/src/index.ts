/**
 * Rihlati Smart Core — shared domain types.
 * Authoritative source: docs/13-execution-plan-core-mvp.md (§13.2 states, §13.3 exceptions, §13.4 A-levels).
 */

// ---------- Booking State Machine (doc 13 §13.2) ----------

export const GREEN_PATH_STATES = [
  'draft',
  'ai_planned',
  'quotation_generated',
  'awaiting_customer_confirmation',
  'awaiting_payment',
  'payment_received',
  'supplier_confirmation_pending',
  'confirmed',
  'ticket_issued',
  'voucher_issued',
  'documents_generated',
  'documents_delivered',
  'pre_travel_reminders_active',
  'in_travel',
  'completed',
  'review_requested',
  'closed',
] as const;

export const EXCEPTION_STATES = [
  'exc_payment_unmatched',
  'exc_payment_failed',
  'exc_ocr_low_confidence',
  'exc_passport_issue',
  'exc_name_mismatch',
  'exc_supplier_error',
  'exc_supplier_price_changed',
  'exc_visa_risk',
  'exc_missing_document',
  'exc_refund_requested',
  'exc_refund_dispute',
  'exc_medical_case',
  'exc_high_value_booking',
  'exc_customer_complaint',
  'exc_sentiment_alert',
  'exc_staff_approval_required',
] as const;

export const TERMINAL_STATES = ['cancelled', 'refunded', 'failed'] as const;

export type BookingState =
  | (typeof GREEN_PATH_STATES)[number]
  | (typeof EXCEPTION_STATES)[number]
  | (typeof TERMINAL_STATES)[number];

/** Allowed forward transitions on the green path. Exception/terminal branching is handled by the engine. */
export const GREEN_TRANSITIONS: Record<string, BookingState[]> = {
  draft: ['ai_planned', 'quotation_generated'],
  ai_planned: ['quotation_generated'],
  quotation_generated: ['awaiting_customer_confirmation'],
  awaiting_customer_confirmation: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['payment_received', 'cancelled'],
  payment_received: ['supplier_confirmation_pending', 'refunded'],
  supplier_confirmation_pending: ['confirmed'],
  confirmed: ['ticket_issued', 'voucher_issued', 'cancelled'],
  ticket_issued: ['documents_generated'],
  voucher_issued: ['documents_generated'],
  documents_generated: ['documents_delivered'],
  documents_delivered: ['pre_travel_reminders_active'],
  pre_travel_reminders_active: ['in_travel'],
  in_travel: ['completed'],
  completed: ['review_requested'],
  review_requested: ['closed'],
  closed: [],
  cancelled: ['refunded'],
  refunded: [],
  failed: [],
};

// ---------- Exception taxonomy (doc 13 §13.3) ----------

export type ExceptionType =
  | 'payment_unmatched'
  | 'payment_failed'
  | 'supplier_error'
  | 'supplier_price_changed'
  | 'ocr_low_confidence'
  | 'passport_expiry_risk'
  | 'name_mismatch'
  | 'visa_risk'
  | 'missing_document'
  | 'refund_requested'
  | 'refund_dispute'
  | 'medical_case'
  | 'high_value_booking'
  | 'customer_complaint'
  | 'sentiment_alert'
  | 'whatsapp_delivery_failed'
  | 'pdf_generation_failed';

export type StaffRole =
  | 'super_admin'
  | 'finance_officer'
  | 'finance_manager'
  | 'booking_officer'
  | 'booking_manager'
  | 'visa_officer'
  | 'medical_officer'
  | 'support_supervisor'
  | 'support_agent'
  | 'ops_admin';

export interface ExceptionSpec {
  role: StaffRole;
  slaMinutes: number;
  severity: 'low' | 'normal' | 'high' | 'critical';
  /** blocking exceptions park the booking in the mapped exc_ state; non-blocking retry/fallback first */
  blocking: boolean;
  bookingState?: BookingState;
}

export const EXCEPTION_TAXONOMY: Record<ExceptionType, ExceptionSpec> = {
  payment_unmatched:        { role: 'finance_officer',    slaMinutes: 60,   severity: 'high',     blocking: true,  bookingState: 'exc_payment_unmatched' },
  payment_failed:           { role: 'finance_officer',    slaMinutes: 60,   severity: 'high',     blocking: true,  bookingState: 'exc_payment_failed' },
  supplier_error:           { role: 'booking_manager',    slaMinutes: 120,  severity: 'high',     blocking: true,  bookingState: 'exc_supplier_error' },
  supplier_price_changed:   { role: 'booking_manager',    slaMinutes: 120,  severity: 'high',     blocking: true,  bookingState: 'exc_supplier_price_changed' },
  ocr_low_confidence:       { role: 'booking_officer',    slaMinutes: 240,  severity: 'normal',   blocking: true,  bookingState: 'exc_ocr_low_confidence' },
  passport_expiry_risk:     { role: 'booking_officer',    slaMinutes: 240,  severity: 'high',     blocking: true,  bookingState: 'exc_passport_issue' },
  name_mismatch:            { role: 'booking_officer',    slaMinutes: 240,  severity: 'high',     blocking: true,  bookingState: 'exc_name_mismatch' },
  visa_risk:                { role: 'visa_officer',       slaMinutes: 480,  severity: 'high',     blocking: true,  bookingState: 'exc_visa_risk' },
  missing_document:         { role: 'visa_officer',       slaMinutes: 1440, severity: 'normal',   blocking: true,  bookingState: 'exc_missing_document' },
  refund_requested:         { role: 'finance_manager',    slaMinutes: 1440, severity: 'normal',   blocking: true,  bookingState: 'exc_refund_requested' },
  refund_dispute:           { role: 'finance_manager',    slaMinutes: 480,  severity: 'high',     blocking: true,  bookingState: 'exc_refund_dispute' },
  medical_case:             { role: 'medical_officer',    slaMinutes: 120,  severity: 'high',     blocking: true,  bookingState: 'exc_medical_case' },
  high_value_booking:       { role: 'booking_manager',    slaMinutes: 240,  severity: 'high',     blocking: true,  bookingState: 'exc_high_value_booking' },
  customer_complaint:       { role: 'support_supervisor', slaMinutes: 120,  severity: 'high',     blocking: true,  bookingState: 'exc_customer_complaint' },
  sentiment_alert:          { role: 'support_supervisor', slaMinutes: 60,   severity: 'high',     blocking: true,  bookingState: 'exc_sentiment_alert' },
  whatsapp_delivery_failed: { role: 'support_agent',      slaMinutes: 480,  severity: 'low',      blocking: false },
  pdf_generation_failed:    { role: 'ops_admin',          slaMinutes: 240,  severity: 'normal',   blocking: false },
};

export const RESOLUTION_ACTIONS = [
  'approve_and_continue',
  'reject_and_notify_customer',
  'request_clearer_passport_image',
  'request_missing_document',
  'confirm_payment_manually',
  'retry_supplier',
  'switch_supplier',
  'reprice_booking',
  'send_updated_quotation',
  'escalate_to_manager',
  'cancel_booking',
  'start_refund_process',
] as const;
export type ResolutionAction = (typeof RESOLUTION_ACTIONS)[number];

// ---------- Automation levels A0–A3 (doc 13 §13.4) ----------

export type AutomationLevel = 'A0' | 'A1' | 'A2' | 'A3';

export type WorkflowKey =
  | 'ai_trip_planning'
  | 'quotation_generation'
  | 'passport_ocr'
  | 'payment_matching'
  | 'visa_precheck'
  | 'whatsapp_messages'
  | 'pdf_generation'
  | 'supplier_confirmation'
  | 'ticket_issuing'
  | 'voucher_sending'
  | 'esim_delivery'
  | 'insurance_delivery'
  | 'refund_initiation'
  | 'agent_commission'
  | 'corporate_invoice'
  | 'loyalty_points'
  | 'visa_final_approval'
  | 'medical_coordination'
  | 'trip_wallet_update';

export interface AutomationSetting {
  workflowKey: WorkflowKey;
  level: AutomationLevel;
  permanentA1: boolean;
  thresholds: { high: number; medium: number };
  params: Record<string, any>;
  killSwitchActive: boolean;
  killSwitchReason?: string;
}

/** Recommended starting levels (doc 13 §13.4). */
export const DEFAULT_AUTOMATION_SETTINGS: Array<Omit<AutomationSetting, 'killSwitchActive'>> = [
  { workflowKey: 'ai_trip_planning',      level: 'A2', permanentA1: false, thresholds: { high: 0.85, medium: 0.6 },  params: {} },
  { workflowKey: 'quotation_generation',  level: 'A2', permanentA1: false, thresholds: { high: 0.85, medium: 0.6 },  params: { autoQuoteCeiling: 10000, vetoMinutes: 15 } },
  { workflowKey: 'passport_ocr',          level: 'A1', permanentA1: false, thresholds: { high: 0.9,  medium: 0.7 },  params: {} },
  { workflowKey: 'payment_matching',      level: 'A1', permanentA1: false, thresholds: { high: 0.9,  medium: 0.75 }, params: { holdMinutes: 15 } },
  { workflowKey: 'visa_precheck',         level: 'A1', permanentA1: false, thresholds: { high: 0.9,  medium: 0.7 },  params: {} },
  { workflowKey: 'whatsapp_messages',     level: 'A3', permanentA1: false, thresholds: { high: 0.5,  medium: 0.3 },  params: { maxRetries: 2 } },
  { workflowKey: 'pdf_generation',        level: 'A3', permanentA1: false, thresholds: { high: 0.5,  medium: 0.3 },  params: { maxRetries: 2 } },
  { workflowKey: 'trip_wallet_update',    level: 'A3', permanentA1: false, thresholds: { high: 0.5,  medium: 0.3 },  params: {} },
  { workflowKey: 'supplier_confirmation', level: 'A1', permanentA1: false, thresholds: { high: 0.9,  medium: 0.7 },  params: { timeoutMinutes: 120 } },
  { workflowKey: 'ticket_issuing',        level: 'A1', permanentA1: false, thresholds: { high: 0.9,  medium: 0.7 },  params: {} },
  { workflowKey: 'voucher_sending',       level: 'A2', permanentA1: false, thresholds: { high: 0.9,  medium: 0.7 },  params: { vetoMinutes: 10 } },
  { workflowKey: 'esim_delivery',         level: 'A3', permanentA1: false, thresholds: { high: 0.8,  medium: 0.6 },  params: {} },
  { workflowKey: 'insurance_delivery',    level: 'A2', permanentA1: false, thresholds: { high: 0.8,  medium: 0.6 },  params: {} },
  { workflowKey: 'refund_initiation',     level: 'A1', permanentA1: true,  thresholds: { high: 0.99, medium: 0.9 },  params: {} },
  { workflowKey: 'visa_final_approval',   level: 'A1', permanentA1: true,  thresholds: { high: 0.99, medium: 0.9 },  params: {} },
  { workflowKey: 'medical_coordination',  level: 'A1', permanentA1: true,  thresholds: { high: 0.99, medium: 0.9 },  params: {} },
  { workflowKey: 'agent_commission',      level: 'A2', permanentA1: false, thresholds: { high: 0.9,  medium: 0.7 },  params: {} },
  { workflowKey: 'corporate_invoice',     level: 'A2', permanentA1: false, thresholds: { high: 0.9,  medium: 0.7 },  params: {} },
  { workflowKey: 'loyalty_points',        level: 'A3', permanentA1: false, thresholds: { high: 0.8,  medium: 0.6 },  params: {} },
];

export type AutomationDecision = 'auto_continue' | 'customer_confirm' | 'staff_veto_window' | 'exception' | 'staff_approval';

export type ActorType = 'system' | 'ai' | 'customer' | 'staff' | 'supplier';

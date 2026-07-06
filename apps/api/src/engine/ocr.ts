import { DataStore } from './store';
import { AuditService } from './audit';
import { AutomationService } from './automation';
import { ExceptionService } from './exceptions';
import { OcrProvider, OcrResult } from './providers';
import { StateMachine } from './state-machine';

/**
 * Passport OCR + MRZ pipeline (doc 13 §13.6).
 * Extract → validate (expiry vs destination rule, name consistency, quality) →
 * automation decision by confidence → auto-fill / customer confirm / exception.
 * Customer always confirms extracted data before payment/issuing (§13.11).
 */
export class OcrService {
  /** months of validity required after return date; per-destination overrides (admin-editable). */
  destinationExpiryMonths: Record<string, number> = { default: 6, TN: 3, EG: 6, TR: 6, AE: 6 };

  constructor(private store: DataStore, private audit: AuditService, private automation: AutomationService, private exceptions: ExceptionService, private provider: OcrProvider, private sm: StateMachine) {}

  monthsBetween(a: Date, b: Date) {
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  }

  async scanPassport(bookingId: string, image: { ref: string; forced?: Partial<OcrResult> }): Promise<{ outcome: string; result: OcrResult; exceptionId?: string; warnings: string[] }> {
    const booking = await this.sm.getBooking(bookingId);
    const result = await this.provider.extractPassport(image);
    const warnings: string[] = [];

    if (!result.imageQualityOk) warnings.push('image_quality_low — request clearer photo');
    if (!result.mrzChecksumOk) warnings.push('mrz_checksum_failed');
    if (result.missingFields.length) warnings.push(`missing_fields:${result.missingFields.join(',')}`);

    // expiry rule vs destination + return date
    const destination = booking.details?.destinationCountry || 'default';
    const requiredMonths = this.destinationExpiryMonths[destination] ?? this.destinationExpiryMonths.default;
    const returnDate = booking.details?.returnDate ? new Date(booking.details.returnDate) : new Date();
    let expiryRisk = false;
    if (result.fields.expiryDate) {
      const months = this.monthsBetween(returnDate, new Date(result.fields.expiryDate));
      if (months < requiredMonths) { expiryRisk = true; warnings.push(`passport_expires_within_${requiredMonths}m_of_return`); }
    }
    // name consistency vs booking customer
    const nameMismatch = !!(result.fields.fullName && !result.fields.fullName.toLowerCase().includes(booking.customerName.split(' ')[0].toLowerCase()) && !booking.customerName.toLowerCase().includes((result.fields.fullName.split(' ')[0] || '').toLowerCase()));

    await this.store.insert('artifacts', { bookingId, kind: 'ocr_extraction', data: result, providerMode: this.provider.mode });
    await this.audit.log({ actorType: 'ai', action: 'ocr_extracted_passport', bookingId, confidence: result.confidence, data: { fields: result.fields, warnings } });

    const effectiveConfidence = result.mrzChecksumOk ? result.confidence : Math.min(result.confidence, 0.6);
    const decision = await this.automation.decide('passport_ocr', effectiveConfidence, { entityType: 'booking', entityId: bookingId, bookingId });

    if (nameMismatch) {
      const exc = await this.exceptions.raise('name_mismatch', bookingId, `Passport name "${result.fields.fullName}" does not match booking customer "${booking.customerName}"`, { fields: result.fields }, ['approve_and_continue', 'request_clearer_passport_image', 'reject_and_notify_customer']);
      return { outcome: 'name_mismatch_exception', result, exceptionId: exc.id, warnings };
    }
    if (expiryRisk) {
      const exc = await this.exceptions.raise('passport_expiry_risk', bookingId, `Passport expires within ${requiredMonths} months of return (${result.fields.expiryDate})`, { expiryDate: result.fields.expiryDate, requiredMonths }, ['approve_and_continue', 'reject_and_notify_customer']);
      return { outcome: 'passport_expiry_exception', result, exceptionId: exc.id, warnings };
    }
    if (decision === 'exception') {
      const exc = await this.exceptions.raise('ocr_low_confidence', bookingId, `OCR confidence ${effectiveConfidence} below threshold`, { result }, ['request_clearer_passport_image', 'approve_and_continue']);
      return { outcome: 'ocr_low_confidence_exception', result, exceptionId: exc.id, warnings };
    }
    if (decision === 'customer_confirm' || decision === 'staff_approval') {
      return { outcome: decision === 'customer_confirm' ? 'needs_customer_confirmation' : 'needs_staff_approval', result, warnings };
    }
    // auto-fill passengers
    await this.store.update('bookings', bookingId, { passengers: [{ ...result.fields, source: 'ocr_autofill' }] });
    return { outcome: 'auto_filled', result, warnings };
  }

  /** Mandatory customer confirmation (doc 13 §13.11) — stored with snapshot + timestamp. */
  async customerConfirms(bookingId: string, confirmedFields: any, meta: { ip?: string; userAgent?: string } = {}) {
    await this.store.insert('customerConfirmations', { bookingId, confirmedFields, ...meta, confirmedAt: new Date().toISOString() });
    await this.store.update('bookings', bookingId, { passengers: [{ ...confirmedFields, source: 'customer_confirmed' }] });
    await this.audit.log({ actorType: 'customer', action: 'customer_confirmed_details', bookingId, data: { fields: Object.keys(confirmedFields) } });
  }
}

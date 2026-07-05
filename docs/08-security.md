# 8 — Security, Privacy & Compliance

The platform stores passports, medical reports, bank receipts, and payment records. Security is a product feature, not an afterthought.

## 8.1 Authentication & access

| Control | Design |
|---|---|
| Customer login | Phone OTP (WhatsApp/SMS) primary; optional email+password; rate-limited (5 attempts / 15 min, exponential backoff) |
| Email verification | Required before invoices/PDF email delivery |
| Staff/admin login | Password (argon2id) + **mandatory TOTP 2FA**; IP allowlist optional; short-lived JWT (15 min) + rotating refresh tokens |
| Agents/corporate | Same as staff-level auth; per-seat accounts (no shared logins) |
| Sessions | Device list in profile, remote revoke, refresh-token reuse detection |
| RBAC | 11 staff roles mapped to granular permissions (`payments.confirm`, `refunds.approve`, `visa.review`, `settings.write`…); deny-by-default; permission checks in service layer |
| Sensitive actions | Refund approval, wallet adjustment, role changes → require 2FA re-prompt + are dual-logged |

## 8.2 Data protection

- **Encryption in transit:** TLS 1.2+ everywhere; HSTS; certificate pinning in the mobile app.
- **Encryption at rest:** disk-level (cloud provider) + **application-level encryption for passport numbers, document files, and medical data** (AES-256-GCM, keys in KMS/vault, rotated).
- **Document storage:** private S3 buckets, no public objects ever; access via short-lived presigned URLs (5 min); antivirus scan on upload; EXIF/location metadata stripped from photos.
- **PII minimization:** AI assistant tools are scoped to the authenticated user; prompts never include other users' data; logs redact passport numbers/phones.
- **Data retention:** visa documents auto-flagged for deletion N months after trip completion (admin-configurable); customer **data deletion request** flow in Settings with staff approval + audit trail.
- **Backups:** encrypted, PITR for PostgreSQL, S3 versioning, restore drills quarterly.

## 8.3 Payment security

- Card data **never** touches our servers — gateway-hosted fields/redirect only (SAQ-A scope if gateways used).
- Double-entry ledger is append-only; wallet balance derived exclusively from ledger; corrections are compensating entries, never edits.
- Receipt uploads (bank transfers) reviewed by Finance role only; confirmation writes audit log.
- Daily reconciliation report: gateway settlements vs ledger vs booking totals.

## 8.4 Application security

- Input validation at the API boundary (DTO schemas); output encoding; parameterized queries only.
- OWASP ASVS L2 as the target baseline; dependency scanning (Dependabot) + SAST in CI.
- Rate limiting per IP + per account; bot protection on OTP endpoints (cost of SMS/WA abuse).
- Webhook signature verification + idempotency for all supplier/payment callbacks.
- Full **audit log**: every staff action on bookings, payments, documents, settings (who/what/before/after/IP).
- Mobile: no secrets in the app binary; jailbreak/root detection advisory; screenshots blocked on document screens (optional).
- Penetration test before public launch and before Phase 2 (payments go live).

## 8.5 Privacy & legal artifacts

- Privacy policy + Terms & Conditions (AR/EN) — in-app, versioned, consent recorded.
- Consent checkboxes: marketing (separate from service messages), document processing for visas, sharing data with suppliers (airlines/hotels/insurers) as required to fulfill bookings.
- WhatsApp: only service messages by default; marketing broadcasts strictly opt-in (Meta policy + user trust).
- Medical data notice: platform organizes travel only; medical reports shared solely with the selected hospital/clinic upon user request.
- Since hosting is in the EU and travelers head to Schengen countries, align with **GDPR principles** (lawful basis, data-subject rights) — this doubles as a trust signal.

## 8.6 Operational security

- Secrets in vault (no secrets in repo/CI logs); least-privilege cloud IAM; separate staging/production data (no production PII in staging).
- Admin dashboard behind SSO + 2FA; optional VPN/IP restriction.
- Incident response runbook: severity levels, customer-notification templates (AR/EN), regulator/partner notification checklist.
- Uptime + queue + error-rate alerts to an ops WhatsApp/Slack channel.

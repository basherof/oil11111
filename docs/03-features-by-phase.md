# 3 — Feature List by Development Phase

Legend: 🟢 full · 🟡 basic version · ⚪ not in phase

| Capability | P1 MVP | P2 Automation | P3 B2B | P4 Smart |
|---|---|---|---|---|
| User mobile app (Flutter) | 🟢 | 🟢 | 🟢 | 🟢 |
| User website (Next.js) | 🟢 | 🟢 | 🟢 | 🟢 |
| Admin dashboard | 🟢 | 🟢 | 🟢 | 🟢 |
| Automated booking pipeline (state machine, system-driven) | 🟢 | 🟢 | 🟢 | 🟢 |
| **Exception Queue** (typed, routed, SLA-timed) | 🟢 | 🟢 | 🟢 | 🟢 |
| Flight flow (manual adapter = exception-generating) | 🟢 | — | — | — |
| Flight **API** booking + auto-issue (Duffel/Amadeus) | ⚪ | 🟢 | 🟢 | 🟢 |
| Hotel flow (manual adapter) | 🟢 | — | — | — |
| Hotel API booking (Hotelbeds/RateHawk) | ⚪ | 🟢 | 🟢 | 🟢 |
| Supplier failover chains + auto-reprice | ⚪ | 🟢 | 🟢 | 🟢 |
| **Passport OCR** + document AI classification | 🟢 | 🟢 | 🟢 | 🟢 |
| Travel packages (fixed, admin-created) | 🟢 | 🟢 | 🟢 | 🟢 |
| Dynamic packages (auto-assembled) | ⚪ | ⚪ | ⚪ | 🟢 |
| Visa checklists + upload + **readiness score** + AI pre-check | 🟢 | 🟢 | 🟢 | 🟢 |
| Medical travel requests | 🟢 | 🟢 | 🟢 | 🟢 |
| Business/exhibition directory + requests | 🟡 | 🟢 | 🟢 | 🟢 |
| eSIM sales (API: Airalo/eSIM Go) | ⚪ | 🟢 | 🟢 | 🟢 |
| Travel insurance requests | 🟡 manual | 🟢 API | 🟢 | 🟢 |
| Airport pickup / transport requests | 🟢 | 🟢 | 🟢 | 🟢 |
| AI trip planner | 🟡 basic | 🟢 | 🟢 | 🟢 advanced |
| AI chat assistant (AR/EN) | 🟡 FAQ+planning | 🟢 | 🟢 | 🟢 booking-connected |
| **Automated quotations** (AI-drafted A1 → instant A3) | 🟡 A1 | 🟢 A3 | 🟢 | 🟢 |
| Payments: transfer **reference auto-match + receipt OCR**, cash | 🟢 | 🟢 | 🟢 | 🟢 |
| Payment gateway (local) + wallet + auto-charge | ⚪ | 🟢 | 🟢 | 🟢 |
| Partial payment / deposits (auto schedules + reminders) | 🟡 | 🟢 | 🟢 | 🟢 |
| Auto refund calculation (staff approve = A1) | ⚪ | 🟢 | 🟢 | 🟢 |
| PDF engine — auto-generated & auto-dispatched | 🟢 | 🟢 | 🟢 | 🟢 |
| **Trip Wallet** (offline documents) | 🟢 | 🟢 | 🟢 | 🟢 |
| WhatsApp outbound automation (state-change templates) | 🟢 | 🟢 | 🟢 | 🟢 |
| WhatsApp inbound **bot** (status, docs, FAQ; human handoff) | ⚪ | 🟢 | 🟢 | 🟢 |
| Live chat + support tickets | 🟢 | 🟢 | 🟢 | 🟢 |
| Smart notifications **rules engine** | 🟡 core rules | 🟢 no-code builder | 🟢 | 🟢 |
| **No-code admin controls** (fees, templates, checklists, automation levels) | 🟡 settings+templates | 🟢 rules builder | 🟢 full suite | 🟢 |
| Touchless-rate / automation analytics | ⚪ | 🟢 | 🟢 | 🟢 |
| User profile + saved travelers + documents | 🟢 | 🟢 | 🟢 | 🟢 |
| Booking status tracking (full lifecycle) | 🟢 | 🟢 | 🟢 | 🟢 |
| Destination pages | 🟡 top 8 | 🟢 all | 🟢 | 🟢 + galleries |
| Maps (hotel/hospital/attraction pins) | 🟡 static links | 🟢 embedded | 🟢 | 🟢 |
| Loyalty & rewards | ⚪ | ⚪ | 🟡 points | 🟢 tiers+cashback |
| Agent dashboard + wallet + commissions | ⚪ | ⚪ | 🟢 | 🟢 |
| Corporate dashboard + approvals + invoices | ⚪ | ⚪ | 🟢 | 🟢 |
| Staff roles & permissions | 🟡 5 roles | 🟢 | 🟢 all 11 | 🟢 |
| Reports & analytics | 🟡 core | 🟢 | 🟢 B2B reports | 🟢 advanced |
| Excel/PDF report export | 🟢 | 🟢 | 🟢 | 🟢 |
| Automations (see §25 list) | 🟡 8 core | 🟢 | 🟢 | 🟢 all |
| Live flight tracking / gate alerts | ⚪ | ⚪ | ⚪ | 🟢 |
| Multi-country expansion | ⚪ | ⚪ | ⚪ | 🟢 |

---

## Phase 1 — MVP (automation-first foundation)

**Goal:** launch a self-service, machine-handled booking system where staff work only a typed Exception Queue. Supplier APIs not required — the manual adapter *generates exceptions* instead of making staff the default path.

**Included:**
- Flutter app + Next.js website + React admin dashboard (built around the Exception Queue)
- Auth: phone OTP + email verification; bilingual UI (AR RTL / EN LTR)
- **Automated booking pipeline**: 12-state machine with system-driven transitions, timers (payment expiry, supplier timeout), and typed exceptions; `requires_action` always bound to an exception record
- **Exception Queue**: typed exceptions, role routing, SLA timers, one-click resolutions, aging escalation
- **Passport OCR** (MRZ + vision model): scan → auto-fill passenger forms → saved traveler profiles; document AI classifies all uploads (app + WhatsApp)
- Visa module: per-country checklists, **readiness score** with weighted items, AI pre-check on upload (auto accept/needs-correction with AR/EN reasons), automated chasing sequences; officer sign-off before submission (A1)
- Medical travel request module (deliberately human-coordinated; AI intake summary)
- AI trip planner: structured intake → 3 options → PDF → quotation; **quotations AI-drafted with one-click staff approval** (instant auto-send arrives with live pricing in P2)
- **Payment automation**: unique payment references per booking, receipt OCR auto-matching with A2 auto-confirm hold, cash at office, deposit schedules with automatic reminders; receipt/invoice PDFs auto-issued
- WhatsApp: **every state change fires its template automatically** (confirmation, ticket PDF, voucher, reminders); inbound messages matched to customer + booking, media auto-filed
- **Trip Wallet**: all issued documents cached offline in-app
- **Smart notifications engine**: core event rules (booking confirmed, payment matched, doc missing, passport expiry 90/30d, T-24h flight, eSIM activation, return reminder)
- Support tickets (9 categories, priorities, auto-assignment round-robin)
- Profiles, saved travelers, uploaded documents, My Trips
- **No-code admin controls (v1)**: service fees, LYD rates + validity windows, deposit %, checklist editor, template studio (WhatsApp/email/PDF AR+EN), automation-level toggles (A0–A3 per workflow), kill switches
- Admin: users, bookings, exception queue, payments, tickets, promotions (basic), reports (bookings/sales/payments/exceptions), 5 staff roles (Super Admin, Booking Manager, Visa Officer, Support Agent, Finance Officer)

**MVP acceptance criteria (samples):**
- A customer books a flight end-to-end — passport scanned, transfer auto-matched, PDF ticket delivered to WhatsApp + Trip Wallet — **with zero staff touches** when nothing goes wrong.
- When something does go wrong, exactly one typed exception appears, routed to the right role, and resolving it resumes the booking automatically.
- A visa file reaches "ready" driven by AI pre-checks and automated reminders; the officer only signs off.
- Admin can change a service fee, a WhatsApp template, and a checklist item without a developer.

## Phase 2 — Full supplier & payment automation

Flight API (Duffel or Amadeus Self-Service) with instant auto-issue · Hotel API (RateHawk/Hotelbeds) · supplier failover chains + auto-reprice-before-charge · local payment gateway integration (Sadad/Moamalat/Tadawul — availability assessment first) + internal wallet + auto-charge · auto refund calculation (A1 approval) · eSIM API (instant QR) · insurance partner API · **instant A3 auto-quotations** from live pricing · WhatsApp inbound bot (status queries, document intake, FAQ, silent human handoff) · no-code visual rules builder · full notification rule set · AI planner using live availability · currency feed · **touchless-rate analytics** (target >70% on standard flight/hotel/eSIM bookings).

## Phase 3 — Business & agent system

Agent dashboard (net fares, markup, wallet/credit limit, commissions, white-label vouchers) · corporate dashboard (employees, policy rules, approval workflow, monthly invoices, department cost reports) · commission engine · monthly invoicing automation · advanced B2B reports · loyalty points (basic accrual) · full 11-role permission matrix.

## Phase 4 — Advanced smart platform

Full conversational AI assistant connected to live booking · dynamic packaging · destination image galleries · live flight status/gate alerts · loyalty tiers (Silver/Gold/VIP/Corporate/Agent) + cashback wallet · advanced analytics/BI · weather integration · multi-country origin expansion (Tunisia, Egypt origins) · marketing automation (offer targeting, quotation follow-up sequences).

---

## Automation checklist (target: Phase where each goes live)

| Automation | Phase |
|---|---|
| Auto booking confirmation (app+email+WhatsApp) | 1 |
| Auto payment receipt PDF | 1 |
| Auto PDF ticket/voucher generation + dispatch | 1 (manual-adapter uploads) / 2 (API auto-issue) |
| Bank-transfer auto-matching (reference + receipt OCR) | 1 |
| Passport OCR auto-fill + expiry warning | 1 |
| AI document pre-check (visa readiness) + missing-document chasing | 1 |
| Auto travel reminders (T-24h etc.) | 1 |
| Auto visa checklist generation | 1 |
| Abandoned booking reminder | 1 |
| Auto support ticket assignment (round-robin by category) | 1 |
| Exception auto-routing + SLA escalation | 1 |
| Instant auto-quotations (A3) + follow-up sequence | 2 |
| Auto refund calculation | 2 |
| WhatsApp inbound bot resolution | 2 |
| Supplier failover + auto-reprice | 2 |
| Loyalty point calculation | 3 |
| Agent commission calculation | 3 |
| Corporate monthly invoice | 3 |
| Dynamic quotation targeting / marketing sequences | 4 |

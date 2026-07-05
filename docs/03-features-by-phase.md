# 3 — Feature List by Development Phase

Legend: 🟢 full · 🟡 basic version · ⚪ not in phase

| Capability | P1 MVP | P2 Automation | P3 B2B | P4 Smart |
|---|---|---|---|---|
| User mobile app (Flutter) | 🟢 | 🟢 | 🟢 | 🟢 |
| User website (Next.js) | 🟢 | 🟢 | 🟢 | 🟢 |
| Admin dashboard | 🟢 | 🟢 | 🟢 | 🟢 |
| Flight **request** flow (semi-manual) | 🟢 | — | — | — |
| Flight **API** booking (Duffel/Amadeus) | ⚪ | 🟢 | 🟢 | 🟢 |
| Hotel request flow | 🟢 | — | — | — |
| Hotel API booking (Hotelbeds/RateHawk) | ⚪ | 🟢 | 🟢 | 🟢 |
| Travel packages (fixed, admin-created) | 🟢 | 🟢 | 🟢 | 🟢 |
| Dynamic packages (auto-assembled) | ⚪ | ⚪ | ⚪ | 🟢 |
| Visa checklists + document upload + review | 🟢 | 🟢 | 🟢 | 🟢 |
| Medical travel requests | 🟢 | 🟢 | 🟢 | 🟢 |
| Business/exhibition directory + requests | 🟡 | 🟢 | 🟢 | 🟢 |
| eSIM sales (API: Airalo/eSIM Go) | ⚪ | 🟢 | 🟢 | 🟢 |
| Travel insurance requests | 🟡 manual | 🟢 API | 🟢 | 🟢 |
| Airport pickup / transport requests | 🟢 | 🟢 | 🟢 | 🟢 |
| AI trip planner | 🟡 basic | 🟢 | 🟢 | 🟢 advanced |
| AI chat assistant (AR/EN) | 🟡 FAQ+planning | 🟢 | 🟢 | 🟢 booking-connected |
| AI quotation generator (staff tool) | 🟢 | 🟢 | 🟢 | 🟢 |
| Payments: cash / bank transfer / manual confirm | 🟢 | 🟢 | 🟢 | 🟢 |
| Payment gateway (local) + wallet | ⚪ | 🟢 | 🟢 | 🟢 |
| Partial payment / deposits | 🟡 manual | 🟢 | 🟢 | 🟢 |
| PDF engine (tickets, vouchers, quotations, invoices) | 🟢 | 🟢 | 🟢 | 🟢 |
| WhatsApp Business API (send + receive + link to booking) | 🟢 | 🟢 | 🟢 | 🟢 |
| Live chat + support tickets | 🟢 | 🟢 | 🟢 | 🟢 |
| Notifications (push/email; SMS optional) | 🟡 core set | 🟢 full set | 🟢 | 🟢 |
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

## Phase 1 — MVP (foundation of trust)

**Goal:** replace the WhatsApp-only travel office workflow with a professional tracked system. No supplier API dependency.

**Included:**
- Flutter app + Next.js website + React admin dashboard
- Auth: phone OTP + email verification; bilingual UI (AR RTL / EN LTR)
- Flight/hotel/package/transport **request → quote → pay → fulfill** pipeline with 12-state status model
- Visa module: checklists per country, document upload, staff review states (received / missing / needs correction / accepted / rejected / under review)
- Medical travel request module
- AI trip planner (basic): structured intake → 3 package options → PDF → quotation request
- AI quotation generator for staff (AR + EN output, PDF, WhatsApp message text)
- Payments: cash at office, bank transfer with receipt upload, manual confirmation, receipt/invoice PDFs
- WhatsApp: send confirmations/tickets/quotations; inbound messages linked to customer + booking
- Support tickets (9 categories, priorities, assignment)
- Profiles, saved travelers, uploaded documents, My Trips
- Core notifications: booking confirmed, payment received, document missing, passport expiry, T-24h flight reminder
- Core automations: auto-confirmation messages, auto PDF dispatch, passport expiry warning, missing-document alert, abandoned-request reminder
- Admin: users, bookings, all request queues, payments, tickets, promotions (basic), reports (bookings/sales/payments), 5 staff roles (Super Admin, Booking Manager, Visa Officer, Support Agent, Finance Officer)

**MVP acceptance criteria (samples):**
- A customer can go from flight search → request → pay by bank transfer → receive PDF ticket on WhatsApp without leaving the app.
- Staff can process a visa file end-to-end with document states and customer notifications.
- Every booking shows a truthful status at all times.

## Phase 2 — Booking automation

Flight API (Duffel or Amadeus Self-Service) with instant ticketing where supported · Hotel API (RateHawk/Hotelbeds) · local payment gateway integration (Sadad/Moamalat/Tadawul — availability assessment first) + internal wallet · eSIM API · insurance partner API · automatic ticket/voucher dispatch · full notification set · AI upgraded to use live availability + richer recommendations · currency exchange rates feed.

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
| Auto PDF ticket/voucher sending | 1 (manual upload) / 2 (API) |
| Auto travel reminders (T-24h etc.) | 1 |
| Auto visa checklist generation | 1 |
| Missing document alert | 1 |
| Passport expiry warning | 1 |
| Abandoned booking reminder | 1 |
| Auto support ticket assignment (round-robin by category) | 2 |
| Loyalty point calculation | 3 |
| Agent commission calculation | 3 |
| Corporate monthly invoice | 3 |
| Quotation follow-up sequence | 4 |

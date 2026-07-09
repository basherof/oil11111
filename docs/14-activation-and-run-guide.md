# 14 — Activation & Run Guide (Smart Core Foundation v0.1)

This guide covers installing, configuring, activating, testing, and verifying the **Core Automation Backend MVP** — the brain of the platform (state machine, exception queue, A0–A3 governance, kill switches, audit logs, payment matching, OCR, visa scoring, WhatsApp/PDF interfaces, Trip Wallet, KPIs, simulator, basic admin console).

> **Zero-setup promise:** with no database and no API keys, the whole smart core runs in **MOCK mode**. You can run all 13 simulator scenarios and use the admin console in under 5 minutes.

---

## A. How to install and run

**Requirements**

| Requirement | Version |
|---|---|
| Node.js | **20+** (`node -v`) |
| Package manager | **npm 10+** (workspaces) |
| PostgreSQL | **15+** — *optional*; only for postgres persistence mode |

**Steps**

```bash
# 1. Clone and enter
git clone https://github.com/basherof/oil11111.git rihlati && cd rihlati

# 2. Install dependencies (npm workspaces)
npm install

# 3. Build the shared domain package (states, exception taxonomy, A-levels)
npm run build -w @rihlati/shared-types

# 4. Configure environment (optional — defaults run in mock mode)
cp .env.example .env

# 5. Run the 13-scenario Booking Flow Simulator (this is also `npm test`)
npm run simulate            # expect: "Simulator result: 13/13 passed"

# 6. Start the backend
npm run dev                 # or: npm run build && npm start
# → API:              http://localhost:3000
# → Customer portal:  http://localhost:3000/admin/portal.html   (AR/EN, RTL)
# → Ops console:      http://localhost:3000/admin/admin.html
# → Support console:  http://localhost:3000/admin/support.html
```

**Database setup (optional, PostgreSQL mode)** — mock/in-memory is the tested default for v0.1; postgres persistence is included as *experimental*:

```bash
createdb rihlati
# in .env:  DATABASE_URL=postgresql://user:pass@localhost:5432/rihlati  and  PERSISTENCE=postgres
cd apps/api
npx prisma generate                 # generate client
npx prisma migrate deploy           # runs prisma/migrations/0001_init (16 tables)
```

**Seed data:** created automatically on first boot — 19 automation settings (recommended launch levels from doc 13 §13.4) and the 11 test users (§5 below). No manual seeding step.

## B. Environment configuration

All variables are in [`.env.example`](../.env.example). Key rules:

- **Empty key ⇒ mock provider.** `WHATSAPP_API_TOKEN`, `OCR_PROVIDER_API_KEY`, `PAYMENT_PROVIDER_KEY`, `EMAIL_PROVIDER_KEY`, `AI_PROVIDER_API_KEY`, `FLIGHT_SUPPLIER_KEY`, `HOTEL_SUPPLIER_KEY` — leave empty and the matching mock provider is used.
- **`GET /health`** and the admin console header always show the current mode: `systemMode: MOCK` and per-provider `mock`/`live` — the system clearly shows when it is using mock vs live.
- `ENABLE_WHATSAPP_AUTOMATION` / `ENABLE_PAYMENT_MATCHING` / `ENABLE_OCR` / `ENABLE_PDF_GENERATION` — boot-time kill switches (set `false` to start with that automation off).
- `DATABASE_URL` + `PERSISTENCE=postgres` → Prisma/PostgreSQL; otherwise in-memory.

## C. How to activate automation features

Activation happens in **two layers**:

| Layer | Where | What it controls |
|---|---|---|
| **Admin dashboard / API** (primary, runtime, audited) | Admin console → *Automation & Kill Switches* tab, or `PUT /api/automation/:workflow/level`, `/thresholds`, `/kill-switch` | A0–A3 level per workflow, confidence thresholds, kill switches — instant, no redeploy, every change audit-logged |
| **Environment variables** (boot defaults) | `.env` `ENABLE_*` flags | Whether a workflow starts killed at boot |

Workflows you can control (19): `ai_trip_planning`, `quotation_generation`, `passport_ocr`, `payment_matching`, `visa_precheck`, `whatsapp_messages`, `pdf_generation`, `trip_wallet_update`, `supplier_confirmation`, `ticket_issuing`, `voucher_sending`, `esim_delivery`, `insurance_delivery`, `refund_initiation`, `agent_commission`, `corporate_invoice`, `loyalty_points`, `visa_final_approval`, `medical_coordination`.

**Permanently locked at A1** (cannot be raised, enforced server-side): `visa_final_approval`, `refund_initiation`, `medical_coordination` — per doc 13 §13.22. Trying `PUT …/level {"level":"A3"}` on these returns HTTP 400.

Example API calls:

```bash
TOKEN=$(curl -s -X POST localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@rihlati.test","password":"Admin@12345"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Raise payment matching to A2 (auto-execute with veto window)
curl -X PUT localhost:3000/api/automation/payment_matching/level \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"level":"A2"}'

# Kill switch: stop all WhatsApp automation instantly
curl -X PUT localhost:3000/api/automation/whatsapp_messages/kill-switch \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"active":true,"reason":"WA provider outage"}'

# Change OCR confidence thresholds (high=auto, medium=confirm, below=exception)
curl -X PUT localhost:3000/api/automation/passport_ocr/thresholds \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"high":0.9,"medium":0.7}'
```

## D. How to test the Booking Flow Simulator

**Commands:**

```bash
npm run simulate                 # all 13 scenarios, asserts, exit 1 on failure (CI mode)
npm run simulate:one -- 6        # one scenario, verbose
```

**Dashboard:** Admin console → *Simulator* tab → click any scenario or **Run ALL 13**. Scenarios run against an isolated engine copy — they never touch live data.

| # | Scenario | What should happen | Booking state | Exception → routed role | How to resolve | Continuation |
|---|---|---|---|---|---|---|
| 1 | Successful automatic booking | Full green path, zero staff touches | `pre_travel_reminders_active` | none | — | Ticket + PDF + WhatsApp + Trip Wallet delivered automatically |
| 2 | Payment unmatched | Transfer without reference can't match | `exc_payment_unmatched` | `payment_unmatched` → **Finance Officer** | *Confirm payment manually* | Resumes, fulfils to delivery |
| 3 | Wrong payment amount | Shows required/received/difference + suggested action | `exc_payment_unmatched` | `payment_unmatched` → **Finance Officer** | *Approve and continue* after remainder received | Resumes to `payment_received` |
| 4 | OCR low confidence | Blurry scan (0.55 < 0.70) | `exc_ocr_low_confidence` | `ocr_low_confidence` → **Booking Officer** | *Request clearer passport image* | Re-scan auto-fills at 0.96 |
| 5 | Passport expiry risk | Expiry < 6 months after return (TR rule) | `exc_passport_issue` | `passport_expiry_risk` → **Booking Officer** | *Approve and continue* (informed override) | Resumes |
| 6 | Supplier error | FLIGHT-A fails → auto-failover to FLIGHT-B → both fail | `exc_supplier_error` | `supplier_error` → **Booking Manager** | *Retry supplier* | Completes via failover supplier |
| 7 | Supplier price change | Reprice 4860→5300 (>2%) — never silently charged | `exc_supplier_price_changed` | `supplier_price_changed` → **Booking Manager** | *Reprice booking* after customer approval | Completes at new price |
| 8 | Visa risk | Low readiness + appointment in 6 days | `exc_missing_document` | → **Visa Officer** | *Request missing document* | Chase sequence; file stays officer-controlled |
| 9 | Missing document | Insurance+invitation missing → chase → uploads → readiness 100% | `exc_missing_document` → resumed | `missing_document` → **Visa Officer** | *Request missing document*, then **officer sign-off (permanent A1)** | `fileStatus: approved_by_officer` |
| 10 | Refund request | Auto-calculated breakdown attached | `exc_refund_requested` → `refunded` | `refund_requested` → **Finance Manager** (A1) | *Start refund process* | Booking → `refunded` |
| 11 | Medical case | ALWAYS human — never automated | `exc_medical_case` | `medical_case` → **Medical Officer** | *Approve and continue* (assign coordinator) | Resumes under human coordination |
| 12 | Customer complaint | Angry Arabic message → silent human handoff + AI summary | `exc_sentiment_alert` | `sentiment_alert` → **Support Supervisor** | *Approve and continue* (take over thread) | Resumes to prior state |
| 13 | WhatsApp/PDF failure | 3 retries → email fallback → **non-blocking** exceptions | stays green | `whatsapp_delivery_failed` + `pdf_generation_failed` | Auto-retry first; staff review | Booking completes anyway |

Every report shows: current state → next state, triggered automation, created exception, assigned role, SLA timer, audit log, recovery action, final result.

## E. How to use the Basic Admin Exception Dashboard

Open **http://localhost:3000/admin/admin.html**, sign in (credentials §5).

| Tab | What you do there |
|---|---|
| **📊 Overview** | Touchless rate, open exceptions, payment match / WhatsApp delivery / PDF success / OCR rates, weekly automation backlog, provider modes |
| **⚡ Exception Queue** | All open exceptions with type, booking, routed role, SLA due, root cause, and **one-click resolution buttons**; resolving resumes the booking automatically |
| **🧾 Bookings** | Every booking with state pill and payment reference; *Open* shows the full record: audit trail, messages, wallet, payments, confirmations, exceptions |
| **🛠 Automation & Kill Switches** | A0–A3 dropdown per workflow (A1-locked ones disabled), thresholds, KILL/re-enable buttons |
| **💳 Payment Matching** | Waiting / unmatched (with difference + suggested action) / matched references; simulate an incoming transfer |
| **🛂 OCR & Documents** | Passport extractions with confidence + MRZ status; visa applications with readiness score and per-document statuses |
| **🧪 Simulator** | Run the 13 scenarios interactively |
| **📜 Audit Log** | Every automated and manual action: actor, action, states, confidence, result |

Role routing is enforced: e.g. the `finance@rihlati.test` login can resolve payment exceptions but not visa ones (super admin can resolve all).

## F. How to confirm the system is working — checklist

```bash
npm install && npm run build -w @rihlati/shared-types   # deps OK
npm run simulate                                        # ⇒ "13/13 passed"
npm run dev                                             # backend starts, banner shows MOCK mode
curl localhost:3000/health                              # {"status":"ok","systemMode":"MOCK",...}
```

| Check | How | Expected |
|---|---|---|
| Backend starts | `npm run dev` | Banner with API + admin URLs, `Persistence: memory (mock mode)` |
| Migrations run | `npx prisma migrate deploy` (postgres mode) | `0001_init` applied, 16 tables |
| Test data created | login as any §5 user | Works on first boot (auto-seed) |
| Simulator all scenarios | `npm run simulate` | **13/13 passed**, exit code 0 |
| Exceptions created correctly | Scenario 2 report / Exception Queue tab | `payment_unmatched` → finance_officer with SLA |
| Booking states update | any scenario report "States:" line | Full green-path chain, exc_ branches + resume |
| Audit logs recorded | Audit tab / `GET /api/audit` | state_transition, ocr_extracted_passport, kill_switch_activated… |
| Payment matching (test mode) | Payments tab → process incoming with a real `TRV-…` reference | `auto_matched` or wrong-amount exception with difference |
| OCR mock works | Scenario 1/4 · OCR tab | Extraction with confidence + MRZ check |
| WhatsApp mock generates messages | booking detail → `messages` | template per state change, `providerMode: mock` |
| PDFs generated/mocked | booking detail → wallet/artifacts | `pdf:flight_ticket` artifact with `mock://` fileRef |
| Trip Wallet records | `GET /api/bookings/:id` → `wallet` | ticket/voucher items, `offlineCached: true` |
| KPIs calculated | Overview tab / `GET /api/kpi` | touchless rate, match rates, top exception causes |

## E2. The three consoles (v0.2)

| Console | URL | Login | What it does |
|---|---|---|---|
| **Customer portal** (بوابة العملاء) | `/admin/portal.html` | Phone OTP — any phone, mock code **123456** | Bilingual AR-first (full RTL) / EN. New booking → AI quotation + 3 options → passport scan (OCR) → mandatory details confirmation → payment reference + "I paid" → live status timeline → Trip Wallet → visa file with readiness score + uploads → AI planner chat → AI support bot with human escalation → refund request |
| **Ops console** (المشغّلون) | `/admin/admin.html` | staff logins (§5) | Exception Queue with **one-click resolutions that run the whole pipeline** (e.g. confirm payment → supplier → ticket → PDF → wallet in one click), bookings, automation levels + kill switches, payment matching board, OCR/visa review, support tickets list, simulator, audit, KPIs |
| **Support console** (خدمة العملاء) | `/admin/support.html` | `support@rihlati.test` (or any staff) | Ticket queue with filters, full conversation view (customer/bot/staff + 🔒 internal notes), **booking context beside the chat** (state, payments, open exceptions, wallet), resolve/close. Bot escalations (anger, refund, "agent/موظف") land here automatically as urgent tickets |

End-to-end demo (2 minutes): portal → login with OTP 123456 → new booking → scan passport → confirm → "I paid" with the exact amount → ops console (finance login) → Exception Queue → **Confirm payment manually** → back to portal: ticket in Trip Wallet, timeline complete. Then in the portal support chat type «موظف» → the ticket appears in the support console.

## 5. Test login credentials

Admin console URL: **http://localhost:3000/admin/admin.html** — ⚠️ *test credentials only; rotate before any real deployment.*

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@rihlati.test` | `Admin@12345` |
| Finance Officer | `finance@rihlati.test` | `Finance@12345` |
| Finance Manager | `finmgr@rihlati.test` | `FinMgr@12345` |
| Booking Officer | `booking@rihlati.test` | `Booking@12345` |
| Booking Manager | `bookmgr@rihlati.test` | `BookMgr@12345` |
| Visa Officer | `visa@rihlati.test` | `Visa@12345` |
| Medical Officer | `medical@rihlati.test` | `Medical@12345` |
| Support Supervisor | `support@rihlati.test` | `Support@12345` |
| Agent (travel office) | `agent1@rihlati.test` | `Agent@12345` |
| Corporate user | `corp1@rihlati.test` | `Corp@12345` |
| Normal customer | `customer@rihlati.test` | `Customer@12345` |

## 6. What's mock vs real in v0.1

| Component | v0.1 status |
|---|---|
| State machine, exception queue, A0–A3 + kill switches, audit, confidence scoring, payment reference/matching, visa scoring, KPI, simulator | **Real engine logic** (fully working) |
| WhatsApp, email, OCR, PDF, AI, flight/hotel suppliers, payment gateway | **Mock providers** behind real interfaces — live adapters plug in at the supplier-integration milestone without engine changes |
| Persistence | In-memory (tested default) · PostgreSQL via Prisma (migrations included, experimental) |
| Admin console | Basic single-file ops console (7 areas) — the full React dashboard is the next milestone per doc 13 §13.0 stage 4 |

Next milestones (per approved order): hardened Postgres persistence → full Admin Exception Dashboard → internal pilot (~50 cases) → customer app + website.

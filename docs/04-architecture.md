# 4 — System Architecture

## 4.1 High-level architecture

```mermaid
flowchart TB
    subgraph Clients
        MA[Mobile App<br/>Flutter iOS+Android]
        WEB[Website<br/>Next.js SSR]
        ADMIN[Admin Dashboard<br/>React SPA]
        AGENT[Agent Dashboard]
        CORP[Corporate Dashboard]
    end

    subgraph Edge
        GW[API Gateway / BFF<br/>REST + WebSocket<br/>rate limit · auth · i18n]
    end

    subgraph Core["Core Backend (NestJS modular monolith)"]
        AUTHM[Auth & Identity<br/>OTP · JWT · 2FA · RBAC]
        BOOK[Booking Engine<br/>unified booking + items + status machine]
        CAT[Catalog<br/>packages · destinations · exhibitions · visas]
        PAY[Payments & Wallet<br/>ledger · invoices · receipts]
        DOC[Documents<br/>upload · review states · secure storage]
        CRM[CRM & Support<br/>tickets · live chat · WhatsApp threads]
        NOTIF[Notifications<br/>push · email · WhatsApp · SMS]
        LOY[Loyalty & Commissions]
        RPT[Reporting & Export]
        AI[AI Orchestrator<br/>assistant · trip builder · quotations]
        PDF[PDF Service<br/>AR/EN branded documents]
    end

    subgraph Async
        Q[(Job Queue<br/>BullMQ / Redis)]
        SCHED[Scheduler<br/>reminders · expiry checks · invoices]
    end

    subgraph Data
        PG[(PostgreSQL 16)]
        REDIS[(Redis cache/sessions)]
        S3[(S3-compatible object storage<br/>documents · PDFs · images)]
        SEARCH[(Meilisearch<br/>AR/EN full-text)]
    end

    subgraph External
        GDS[Flight APIs<br/>Duffel / Amadeus]
        HOT[Hotel APIs<br/>RateHawk / Hotelbeds]
        WA[WhatsApp Business API]
        PAYGW[Local payment gateways<br/>Sadad · Moamalat · wallets]
        ESIM[eSIM API<br/>Airalo / eSIM Go]
        INS[Insurance partner API]
        LLM[Claude API<br/>AI assistant models]
        MAPS[Google Maps]
        FX[Currency / Weather APIs]
        MAIL[Email + SMS providers]
    end

    Clients --> GW --> Core
    Core <--> Q
    SCHED --> Q
    Core --> PG & REDIS & S3 & SEARCH
    BOOK <--> GDS & HOT
    PAY <--> PAYGW
    NOTIF & CRM <--> WA
    NOTIF --> MAIL
    AI <--> LLM
    CAT --> MAPS
    BOOK --> ESIM & INS
    Core --> FX
```

## 4.2 Key architectural decisions

| Decision | Choice | Why |
|---|---|---|
| Backend shape | **Modular monolith** (NestJS), module-per-domain, extractable later | Small team, fast iteration, one deployment; clean module boundaries allow extracting AI/PDF/notifications into services when scale demands |
| Booking model | **Unified `bookings` + polymorphic `booking_items`** | Flights, hotels, visas, eSIM, transfers, packages all share one lifecycle, one payment ledger, one PDF/notification pipeline |
| Fulfillment | **Supplier-adapter pattern** | `ManualFulfillment` adapter in MVP; `DuffelAdapter`, `RateHawkAdapter`, `AiraloAdapter` plug into the same interface in Phase 2 — no dependency on a single supplier |
| Status handling | **Explicit state machine** per booking item with audit trail | The user requirement "status is always visible/truthful" demands guarded transitions + `status_history` |
| Money | **Double-entry ledger** (`ledger_entries`) for wallets, agent balances, commissions | Cash/transfer/wallet mixes and agent credit limits need auditable accounting from day one |
| i18n | Locale in every content table (`_ar` / `_en` columns or translation table); ICU messages in clients | Arabic-first requirement; PDFs and WhatsApp templates also templated per locale |
| Files | Pre-signed S3 URLs, private buckets, AV scan on upload | Passports and medical reports are highly sensitive |
| Realtime | WebSocket (chat, booking status) + FCM push | Live chat + status updates |
| AI | Dedicated orchestrator module with **tool-calling** into internal APIs (search, packages, visa KB, quotation) | The assistant must act, not just chat — and stay inside guardrails |

## 4.3 Booking lifecycle state machine

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> pending_payment: customer submits
    draft --> cancelled: abandoned/expired
    pending_payment --> payment_received: finance confirms / gateway webhook
    pending_payment --> cancelled
    payment_received --> processing: assigned to staff / auto
    processing --> waiting_supplier: sent to supplier
    waiting_supplier --> confirmed: supplier confirms
    processing --> confirmed
    confirmed --> ticket_issued: ticket/voucher generated
    ticket_issued --> completed: travel date passed
    confirmed --> requires_action: schedule change / document missing
    requires_action --> processing
    payment_received --> refunded: refund approved
    confirmed --> cancelled
    cancelled --> refunded
    completed --> [*]
```

Rules: transitions only via service layer (never raw updates); each transition writes `status_history` (who, when, note) and fires notification events.

## 4.4 Request flow — MVP semi-manual flight booking

```mermaid
sequenceDiagram
    actor C as Customer (app)
    participant API as Backend
    participant A as Admin staff
    participant WA as WhatsApp API

    C->>API: Flight search (route, dates, pax)
    API-->>C: Results (cached fares / on-request)
    C->>API: Submit request + passengers + payment method
    API->>API: Passport expiry check → warning
    API-->>C: Booking ref, status=pending_payment
    API->>WA: "Request received" message
    C->>API: Upload bank transfer receipt
    A->>API: Finance confirms payment → payment_received
    A->>API: Issues ticket at supplier, uploads e-ticket PDF
    API->>API: status=ticket_issued, generate branded PDF
    par deliver
        API->>C: Push notification + in-app trip
        API->>WA: PDF ticket via WhatsApp
        API->>C: Email confirmation
    end
```

Phase 2 replaces the two staff steps with supplier-adapter API calls; everything else is unchanged.

## 4.5 AI orchestrator (summary — full design in [11-ai-assistant.md](11-ai-assistant.md))

- Claude API with **tool use**: `search_flights`, `search_hotels`, `list_packages`, `get_visa_requirements`, `create_quotation_request`, `get_destination_guide`, `estimate_budget`.
- RAG over internal knowledge base: visa requirements, FAQs, destination guides, policies (Meilisearch/pgvector).
- Guardrails enforced server-side (not only in the prompt): price responses stamped "estimated" unless sourced from a live fare object; medical/visa answers append human-support handoff; PII never crosses user boundaries (tools are scoped to the authenticated user).

## 4.6 Deployment & operations

- **Runtime:** Docker on a managed VPS/cloud (Hetzner/AWS); staging + production; blue-green or rolling deploys via GitHub Actions CI/CD.
- **Resilience for Libyan connectivity:** app-side request retry queues, small payloads, image CDN with aggressive caching, offline viewing of issued tickets/vouchers (stored locally in app).
- **Backups:** PostgreSQL PITR (WAL archiving) + nightly snapshots; S3 versioning; quarterly restore drills.
- **Observability:** structured logs, Sentry (clients + backend), uptime probes, queue depth alerts.
- **Environments/config:** 12-factor, secrets in a vault, per-env feature flags (e.g., `flights.api_mode = manual|duffel`).

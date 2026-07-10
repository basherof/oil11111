# App Flow Diagrams

Mermaid — renders directly on GitHub.

## 1. App map (mobile)

```mermaid
flowchart TD
    SPLASH[Splash] --> LANG[Language: العربية / English]
    LANG --> AUTH{Registered?}
    AUTH -->|No| REG[Register: phone → OTP → name]
    AUTH -->|Yes| LOGIN[Login OTP]
    REG --> HOME
    LOGIN --> HOME[Home]

    HOME --> F[Flights]
    HOME --> H[Hotels]
    HOME --> P[Packages]
    HOME --> V[Visa Services]
    HOME --> M[Medical Travel]
    HOME --> AIP[AI Trip Planner]
    HOME --> MORE[More: Business · eSIM · Insurance · Pickup · Destinations]

    subgraph TABS[Bottom navigation]
        HOME
        TRIPS[My Trips]
        AIP
        SUP[Support]
        PROF[Profile]
    end

    TRIPS --> BD[Booking details + documents + status]
    SUP --> WA[WhatsApp] & TICKETS[Support tickets] & CHAT[Live chat / AI]
    PROF --> SAVED[Saved travelers] & DOCS[My documents] & LOY[Loyalty] & PAYH[Payment history] & SET[Settings]
```

## 2. Flight booking flow — automated green path

```mermaid
flowchart TD
    S[Search form<br/>route · dates · pax · class · preferences] --> R[Results + filters + labels]
    R --> D[Flight details<br/>segments · baggage · fare rules · fees<br/>auto-reprice before checkout]
    D --> PAX[Passenger details<br/>📷 scan passport → OCR auto-fill<br/>or pick saved travelers]
    PAX --> OCRC{OCR confidence ≥ 90%<br/>+ MRZ checksum?}
    OCRC -->|No| EXC1[⚠ exception: ocr_low_confidence<br/>ask better photo / staff correct]
    OCRC -->|Yes| CHK{Passport valid<br/>6+ months after return?}
    CHK -->|No| WARN[⚠ Expiry warning<br/>continue or fix] --> PAY
    CHK -->|Yes| PAY[Payment<br/>transfer w/ unique reference · wallet · gateway · cash]
    PAY -->|Transfer| RCPT[Upload receipt → OCR auto-match] --> HOLD{Matched?}
    HOLD -->|Yes, after hold| CONF[Payment received — auto]
    HOLD -->|No| EXC2[⚠ exception: payment_unmatched<br/>→ Finance]
    PAY -->|Wallet / gateway| CONF
    PAY -->|Cash| OFFICE[Office records] --> CONF
    CONF --> SUP[Supplier adapter book + issue<br/>manual adapter = fulfillment exception in MVP]
    SUP -->|OK| TKT[Ticket issued — auto PDF]
    SUP -->|Fail| EXC3[⚠ exception: supplier_error<br/>alternatives pre-searched]
    TKT --> OUT[Trip Wallet offline + WhatsApp PDF + email<br/>zero staff touches]
    EXC1 & EXC2 & EXC3 -.resolved.-> RESUME[State machine resumes]
```

## 3. Visa application flow — AI pre-check + readiness score

```mermaid
flowchart TD
    VS[Visa section] --> VC[Country + visa type page<br/>requirements · warnings · processing time]
    VC --> START[Start application] --> CL[Auto-generated checklist<br/>readiness score 0%]
    CL --> UP[Upload documents<br/>app · web · WhatsApp]
    UP --> AI{AI pre-check<br/>type? readable? dates? spec?}
    AI -->|pass| ACC[Auto-accepted → score rises]
    AI -->|fail| CORR[Auto: needs correction<br/>AR/EN reason → push + WhatsApp] --> UP
    AI -->|uncertain| OFF[Visa officer reviews<br/>exception item]
    ACC --> SCORE{Score = 100%<br/>hard-fails clear?}
    SCORE -->|No, aging| CHASE[Automated chasing<br/>D+1 · D+3 · appt−7] --> UP
    SCORE -->|Yes| SIGN[Officer sign-off — A1 by design] --> SUB[File submitted / appointment set]
    SUB --> APPT[Appointment reminders D-7 · D-1] --> DEC{Decision}
    DEC -->|Approved| DONE[🎉 + trip planning offer]
    DEC -->|Rejected| SUPRT[Support consultation offer]
```

## 4. AI trip planner flow

```mermaid
flowchart TD
    IN[User goal in AR/EN<br/>chat or Build-My-Trip form] --> Q[AI intake<br/>dates · pax · budget · level · extras]
    Q --> GEN[3 options: Economy · Standard · Premium<br/>est. prices + itinerary + images]
    GEN --> A1[Download PDF]
    GEN --> A2[Send to WhatsApp]
    GEN --> A3[Request official quotation] --> TASK[Admin task + AI draft] --> OQ[Staff verify → branded PDF<br/>SLA 2h] --> BOOKQ[Customer accepts → booking created]
    GEN --> A4[Book now] --> BOOK[Booking flow prefilled]
```

## 5. Support & WhatsApp routing

```mermaid
flowchart TD
    IN1[In-app chat] --> BOT{AI triage}
    IN2[WhatsApp inbound] --> MATCH[Match phone → customer + booking] --> QUEUE
    BOT -->|FAQ answered| DONE1[Resolved]
    BOT -->|Needs human| QUEUE[Support queue by category]
    QUEUE --> AGENT[Agent console:<br/>profile · bookings · payments · docs · history]
    AGENT --> RES[Resolve + ticket status] --> CSAT[Rating request]
```

## 6. Corporate approval flow

```mermaid
flowchart TD
    E[Employee travel request] --> POL{Within travel policy?}
    POL -->|No| ADJ[Flag + justification required]
    POL -->|Yes| MGR[Manager approval]
    ADJ --> MGR
    MGR -->|Rejected| END1[Closed + reason]
    MGR -->|Approved| OPS[Admin books trip] --> BK[Booking in company dashboard]
    BK --> INV[Monthly consolidated invoice] --> RPT[Department spending reports]
```

## 7. Exception queue — the only staff work surface

```mermaid
flowchart TD
    FAIL[Any automation failure<br/>payment · supplier · OCR · visa risk · sentiment] --> TYPE[Typed exception created<br/>context + suggested actions attached]
    TYPE --> ROUTE[Auto-route to role<br/>round-robin + load balance] --> SLA[SLA timer starts]
    SLA --> WORK[Staff one-click resolution<br/>match · rebook · correct · approve · take over]
    SLA -->|80% of SLA| ESC[Escalate to team lead]
    WORK --> RESUME[Bound state machine resumes automatically]
    WORK --> LEARN[Weekly: top exception causes<br/>→ automation backlog]
```

## 8. Agent booking flow

```mermaid
flowchart TD
    AG[Agent login] --> SR[Search flights/hotels<br/>NET prices shown]
    SR --> CD[Enter customer data] --> MU[Add markup]
    MU --> PAYA{Pay}
    PAYA -->|Wallet balance| OK
    PAYA -->|Credit limit| OK[Booking confirmed]
    PAYA -->|Insufficient| TOPUP[Top-up request] --> OK
    OK --> TK[Download white-label ticket] --> COMM[Commission recorded]
```

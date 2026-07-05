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

## 2. Flight booking flow (MVP)

```mermaid
flowchart TD
    S[Search form<br/>route · dates · pax · class · preferences] --> R[Results + filters + labels]
    R --> D[Flight details<br/>segments · baggage · fare rules · fees]
    D --> PAX[Passenger details<br/>saved travelers or manual entry]
    PAX --> CHK{Passport valid<br/>6+ months after return?}
    CHK -->|No| WARN[⚠ Expiry warning<br/>continue or fix] --> PAY
    CHK -->|Yes| PAY[Payment method<br/>cash · transfer · wallet]
    PAY -->|Bank transfer| RCPT[Upload receipt] --> PEND[Status: pending payment]
    PAY -->|Cash| PEND
    PAY -->|Wallet| CONF
    PEND --> FIN[Finance confirms] --> CONF[Payment received]
    CONF --> STAFF[Staff issue ticket<br/>P2: API auto-issue] --> TKT[Ticket issued]
    TKT --> OUT[PDF in app + WhatsApp + email<br/>trip added to My Trips]
```

## 3. Visa application flow

```mermaid
flowchart TD
    VS[Visa section] --> VC[Country + visa type page<br/>requirements · warnings · processing time]
    VC --> START[Start application] --> CL[Auto-generated checklist]
    CL --> UP[Upload documents<br/>app · web · WhatsApp]
    UP --> REV{Staff review per document}
    REV -->|needs correction / missing| NOTIF[Notify customer<br/>push + WhatsApp] --> UP
    REV -->|all accepted| SUB[File submitted / appointment set]
    SUB --> APPT[Appointment reminder] --> DEC{Decision}
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

## 7. Agent booking flow

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

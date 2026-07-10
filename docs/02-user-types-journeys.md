# 2 — User Types & Journey Maps

## 2.1 The eight user types

| # | User type | Primary goals | Key features used |
|---|---|---|---|
| 1 | **Normal customer** | Book flight/hotel fast, pay locally, get ticket on WhatsApp | Search, booking, payments, My Trips, support |
| 2 | **Family traveler** | Book for 3–6 people without retyping passports | Saved travelers, family packages, family-friendly labels |
| 3 | **Medical traveler** | Reach treatment abroad with zero logistics stress | Medical section, report upload, translator, hotel-near-hospital |
| 4 | **Student traveler** | Study visa + flight + accommodation | Student packages, visa checklists, document upload |
| 5 | **Business traveler** | Exhibitions, meetings, fast quotations | Exhibition directory, business packages, express support |
| 6 | **Corporate client** | Control employee travel + spending | Corporate dashboard, approvals, invoices, reports |
| 7 | **Agent / travel office** | Resell inventory with commission | Agent dashboard, wallet/credit, markup, white-label vouchers |
| 8 | **Admin staff** | Operate everything | Admin dashboard, role-based permissions |

## 2.2 Persona snapshots

- **Fatima, 34, Tripoli** — mother of two, travels to Istanbul every summer. Doesn't trust online payment; pays by bank transfer. Books everything over WhatsApp today. *Needs:* saved family passports, clear total price, WhatsApp confirmation.
- **Omar, 58, Benghazi** — needs cardiac treatment in Tunis. Son manages his phone. *Needs:* one big "السفر العلاجي" button, upload reports, someone to call him back.
- **Aya, 22, Misrata** — accepted to a language school in Turkey. *Needs:* student visa checklist, proof-of-accommodation booking, deadline reminders.
- **Trading company, Tripoli** — sends 5 employees to Gulfood Dubai yearly. *Needs:* one quotation, one invoice, manager approval, spending report.
- **Al-Safir Travel Office, Sabha** — small agency without GDS access. *Needs:* agent login, net prices + own markup, wallet balance, printable tickets.

## 2.3 Journey map — Normal traveler (flight, automated green path)

| Stage | User action | System action (zero staff touches) | Emotion target |
|---|---|---|---|
| Discover | Opens app, picks Arabic | Localized home, popular routes from TIP/BEN | Welcome, familiar |
| Search | Tripoli → Istanbul, dates, 2 pax | Live/adapter results; price re-confirmed before checkout | Confidence: clear prices |
| Compare | Filters: direct, baggage | Labels: cheapest / best value / fastest / family-friendly | Control |
| Details | **Scans passports 📷** or picks saved travelers | OCR auto-fills forms; expiry check → warning if <6 months validity | Effortless |
| Pay | Bank transfer with unique reference, uploads receipt (or wallet/gateway) | Receipt OCR auto-matches → auto-confirm after short hold → *Payment received* | Trust |
| Fulfill | Nothing — it just happens | Supplier adapter books + issues; state → *Ticket issued*; branded PDF generated | Relief |
| Receive | Gets app notification + WhatsApp PDF + email | Auto-dispatch to all channels + offline **Trip Wallet** | Delight |
| Pre-trip | — | T-24h flight reminder, check-in reminder, baggage note, eSIM activation prompt | Supported |
| Post-trip | Rates experience | Loyalty points credited; return-flight reminder | Loyalty |

*Exception path:* if any step fails (unmatched payment, supplier error, blurry passport photo), the booking enters `requires_action`, a typed exception routes to the right staff role with SLA, and the customer gets an honest automated status message. Staff appear only here.

## 2.4 Journey map — Medical traveler (Tunisia)

1. Home → **Medical Travel** → chooses Tunisia + specialty (cardiology).
2. Uploads medical reports (or sends via WhatsApp — staff attach to profile).
3. Requests: translator ✓, hotel near hospital ✓, 1 companion.
4. Status → *Under processing*. Medical Travel Officer contacts clinics, builds package.
5. Customer receives **PDF medical package**: appointment date, clinic, hotel, pickup, translator, total estimated cost.
6. Approves → pays deposit → *Confirmed*. Full itinerary in My Trips; hospital + hotel pinned on map.
7. T-48h reminders; emergency support number pinned during trip.
8. *App never gives medical advice — logistics only, stated clearly in UI.*

## 2.5 Journey map — Corporate booking

```
Employee submits travel request → Manager approves in corporate dashboard
→ Admin staff books (flight+hotel+visa) → Booking appears in company dashboard
→ Monthly consolidated invoice → Finance downloads report by department
```

Policy rules applied automatically at request time: max hotel stars, allowed airlines, advance-booking days, approval threshold amounts.

## 2.6 Journey map — Agent booking

```
Agent logs in → searches flight → enters customer passport data
→ sees NET price → adds own markup → pays from wallet balance (or credit limit)
→ system confirms → agent downloads branded/white-label ticket
→ commission auto-recorded → visible in commission report
```

## 2.7 Journey map — AI-planned family trip

1. User taps **AI Trip Planner**: "أبي أسافر اسطنبول ٧ أيام مع عائلتي" (I want Istanbul 7 days with my family).
2. AI asks (one question per bubble): dates → 2 adults + 2 kids → budget → hotel level → pickup? → eSIM? → visa help?
3. AI generates **3 options** (Economy / Standard / Premium), each with flight idea, hotel idea, daily program, estimated cost, included/excluded lists, destination images.
4. Buttons per option: **Request official quotation** · **Book now** · **Send to WhatsApp** · **Download PDF**.
5. "Request quotation": when all lines are priceable from live adapters/current rate tables, the official branded PDF is **generated and sent within seconds** (auto-quote); otherwise AI drafts it and staff approve with one click (fallback SLA: 2 working hours).
6. AI prices labeled **"سعر تقريبي / Estimated price"** until repriced from a live source; "Book now" enters the automated booking path with passengers and payment prefilled.

## 2.8 Cross-journey rules

- Every journey runs its **green path automatically**; humans enter only via the typed Exception Queue ([12-automation-first.md](12-automation-first.md)). Medical travel is the deliberate exception: always human-coordinated.
- Every journey exposes a persistent **WhatsApp support** entry point (bot-first, silent human handoff on sensitive intents).
- Every request produces a **trackable status** (see status model in [05-database-schema.md](05-database-schema.md)).
- Every confirmed service produces a **branded PDF** and lands in **My Trips**.
- Passport expiry (< 6 months from return date) triggers warnings at search, checkout, and via notification.

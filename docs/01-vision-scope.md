# 1 — Vision & Scope

## Vision

Build the **best smart travel platform for Libya**: a full digital travel agency that helps individuals, families, companies, students, medical travelers, and business travelers plan, book, manage, and complete their entire trip in one place — with AI planning, deep WhatsApp support, local payments, and real human service.

## What we are (and are not)

| We are | We are not |
|---|---|
| A full-service digital travel platform with operational control | A price-comparison meta-search |
| Arabic-first, built around how Libyans actually book travel | A translated clone of a Western OTA |
| An **automation-first travel operating system** — machine-handled by default, humans on exceptions | A staff-driven back office with an app on top |
| A visa/document preparation partner | A visa guarantee service or law firm |
| A medical travel *organizer* (logistics only) | A medical advice or diagnosis provider |

## Target market

- **Primary:** travelers departing Libya (Tripoli MJI, Benghazi BEN, Misrata MRA) to Turkey, Tunisia, Egypt, UAE, Saudi Arabia, Jordan, and Schengen Europe (Germany, Italy, Spain), UK, Canada.
- **Segments:** leisure/family, medical (Tunisia, Egypt, Turkey, Jordan), students, business/exhibitions, Umrah (future), corporate accounts, and B2B travel offices/agents across Libya.

## Why now / why us — competitive advantage

1. **Understands Libyan travelers** — payment realities (cash, bank transfer, agent networks), document pain (visas, passport rules), and the WhatsApp-first service culture.
2. **Visa & document preparation as a core product**, not an afterthought — checklists, uploads, staff review, appointment guidance.
3. **Complete packages** — flight + hotel + pickup + eSIM + insurance + visa support in one quotation PDF.
4. **AI trip planning in Arabic** — natural-language planning connected to real inventory and quotation flows.
5. **Serves every segment from one core** — B2C, medical, students, corporate, and B2B agents share the same booking engine and admin operation.
6. **Automation-first from day one** — the default path of every workflow is machine-handled (AI quotations, OCR, auto-matched payments, auto-dispatched documents); where a supplier API isn't live yet, the manual adapter raises a tracked exception instead of making staff the default. Suppliers plug in later without changing the customer experience. See [12-automation-first.md](12-automation-first.md).

## Guiding product principles

1. **Simple enough for a non-technical Libyan customer.** Max 3–4 fields per screen, big buttons, plain Arabic, no jargon.
2. **Arabic-first, bilingual always.** Every screen, PDF, notification, and WhatsApp message exists in AR (RTL) and EN (LTR).
3. **Nothing is a dead end.** Every screen offers "تواصل معنا واتساب / Chat on WhatsApp" as a fallback to a human.
4. **Prices are honest.** Show base price, service fee, and total. Say "estimated" when not confirmed.
5. **Status is always visible.** Every request has a clear status the customer can check without asking.
6. **The AI assists, never guarantees.** Estimated prices labeled, no legal/medical/visa guarantees, human handoff for sensitive cases.
7. **Automate the path, humanize the exception.** Every workflow ships with a fully automated green path; humans intervene only through the typed Exception Queue — and those interventions are measured and automated away over time.

## Brand personality

Reliable · Helpful · Smart · Local · Professional · Safe · Fast · Premium but accessible.

## Scope summary (full platform)

1. Mobile app (iOS + Android) for customers
2. Responsive website for customers
3. Admin dashboard (company operations)
4. Agent dashboard (travel offices / sales agents)
5. Corporate dashboard (company clients)
6. AI travel assistant + trip builder + quotation generator
7. Booking engine: flights, hotels, packages, visas, eSIM, insurance, transport, medical, business travel
8. Payment system (Libya-appropriate) + wallet
9. WhatsApp Business API + live chat + ticketing
10. Notifications & trip management
11. Loyalty & rewards
12. Reports & accounting

Detailed scoping per phase: see [03-features-by-phase.md](03-features-by-phase.md).

## Out of scope (v1)

- Direct GDS ticket issuance (Phase 2)
- Online card payments via international gateways (Phase 2, gateway availability dependent)
- Umrah/Hajj packages (future — requires Saudi ministry integrations)
- Multi-country expansion beyond Libya origin market (Phase 4)
- Live flight tracking / gate change feeds (Phase 4)

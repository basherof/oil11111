# Rihlati — رحلتي | Libyan Smart Travel Platform

**Working brand name:** *Rihlati* ("My Journey" — رحلتي). Placeholder — final name subject to trademark check in Libya.

A complete digital travel agency for the Libyan market: flights, hotels, visas, travel packages, medical travel, business/exhibition travel, eSIM, insurance, airport pickup — with an AI travel assistant, deep WhatsApp integration, and local payment support. Arabic-first, fully bilingual (AR RTL / EN LTR).

> The goal is not another booking app. It is a **travel ecosystem** that helps a Libyan traveler plan, book, document, pay for, and complete an entire trip — with human support one tap away.

---

## 📁 Repository map

| Path | Contents |
|---|---|
| [`docs/01-vision-scope.md`](docs/01-vision-scope.md) | Vision, market positioning, competitive advantage |
| [`docs/02-user-types-journeys.md`](docs/02-user-types-journeys.md) | 8 user personas + full user journey maps |
| [`docs/03-features-by-phase.md`](docs/03-features-by-phase.md) | Complete feature list broken into 4 development phases |
| [`docs/04-architecture.md`](docs/04-architecture.md) | System architecture, service design, diagrams |
| [`docs/05-database-schema.md`](docs/05-database-schema.md) | Full PostgreSQL data model (60+ tables) |
| [`docs/06-integrations.md`](docs/06-integrations.md) | Flight/hotel APIs, WhatsApp, payments, eSIM, maps, AI |
| [`docs/07-tech-stack.md`](docs/07-tech-stack.md) | Recommended technology stack with justifications |
| [`docs/08-security.md`](docs/08-security.md) | Security, privacy, and compliance design |
| [`docs/09-timeline-cost.md`](docs/09-timeline-cost.md) | Development timeline, team plan, cost estimate |
| [`docs/10-recommendations.md`](docs/10-recommendations.md) | Suggestions to improve the idea further |
| [`docs/11-ai-assistant.md`](docs/11-ai-assistant.md) | AI travel assistant / trip builder / quotation generator design |
| [`design/design-system.md`](design/design-system.md) | Brand, colors, typography, components, RTL rules |
| [`design/user-flows.md`](design/user-flows.md) | App flow diagrams (Mermaid — renders on GitHub) |
| [`design/wireframes/mobile-app.html`](design/wireframes/mobile-app.html) | Mobile app wireframes — 16 key screens, AR/EN |
| [`design/wireframes/website.html`](design/wireframes/website.html) | Website design — home, destination, package pages |
| [`design/wireframes/admin-dashboard.html`](design/wireframes/admin-dashboard.html) | Admin dashboard — overview, bookings, visa review |

Open the wireframe HTML files in any browser — they are self-contained (no build step, no dependencies).

## 🚀 The one-paragraph pitch

Libyan travelers today book trips through WhatsApp messages to travel offices, with no visibility into prices, documents, or booking status. Rihlati digitizes the entire travel-office experience — search, quotation, visa checklist, document upload, payment tracking, ticket delivery — while keeping the human, WhatsApp-centered service Libyans trust. It serves individuals, families, medical travelers, students, business travelers, corporations, and travel agents from one platform, and its AI assistant plans complete trips in Arabic.

## 🧭 First release (MVP) focus

1. Professional user app (Flutter) + website (Next.js)
2. Admin dashboard with full booking lifecycle
3. Booking *request* flow (semi-manual fulfillment — no GDS dependency at launch)
4. AI trip planner (basic) + AI quotation generator for staff
5. Visa checklists + document upload + review workflow
6. Branded PDF quotations, tickets, vouchers (AR/EN)
7. WhatsApp Business API integration
8. Payment tracking (cash, bank transfer, wallet) with manual confirmation
9. User profiles + saved travelers (family passports)
10. Support ticket system

See [docs/03-features-by-phase.md](docs/03-features-by-phase.md) for the complete phased plan.

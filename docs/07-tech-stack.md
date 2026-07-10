# 7 — Recommended Technology Stack

## 7.1 Summary

| Layer | Choice | Why (vs alternatives) |
|---|---|---|
| Mobile app | **Flutter** | One codebase iOS+Android, excellent **RTL support out of the box**, consistent premium UI on low-end Android devices common in Libya; better rendering consistency than React Native for heavy custom design |
| Website | **Next.js 15 (React, App Router)** | SSR/SSG for SEO on destination/package/visa pages (organic acquisition channel), i18n routing (`/ar`, `/en`), fast on weak connections |
| Admin/Agent/Corporate dashboards | **React + Vite + shadcn/ui + TanStack Table/Query** | One dashboard codebase, role-gated modules; rich tables, fast iteration |
| Backend | **Node.js + NestJS (TypeScript)** | Modular monolith with enforced module boundaries, first-class DI/validation, one language across web + backend team |
| Database | **PostgreSQL 16** | JSONB for booking payloads, row-level security, `pgvector` for AI RAG, PITR backups |
| ORM | Prisma (or Drizzle) | Type-safe schema, migration discipline |
| Cache/queue | **Redis + BullMQ** | Sessions, rate limits, job queue (notifications, PDFs, reminders, webhooks) |
| Search | **Meilisearch** | Excellent Arabic tokenization for destinations/hotels/FAQ; simpler than Elasticsearch |
| Object storage | S3-compatible (AWS S3 / Cloudflare R2 / Hetzner) | Private buckets for passports/medical docs; presigned URLs |
| PDF generation | **Headless Chromium (Playwright) rendering HTML templates** | Single template system produces pixel-perfect **Arabic RTL PDFs** with brand fonts — far better AR shaping than pdfkit-style libs |
| AI | **Claude API** — `claude-fable-5` for trip planning & quotation writing, `claude-haiku-4-5` for chat triage/classification | Strong Arabic, tool-calling for booking-connected assistant; orchestration layer kept provider-agnostic |
| Push | Firebase Cloud Messaging | Standard |
| Realtime | WebSocket gateway (NestJS) | Live chat + status updates |
| Auth | Phone OTP (WhatsApp/SMS) + JWT access/refresh; TOTP 2FA for staff | Matches Libyan phone-first behavior |
| CI/CD | GitHub Actions → Docker → staging/prod | Standard |
| Hosting | Managed cloud (Hetzner EU or AWS eu-south) | Low latency to Libya; EU data-center jurisdiction |
| Monitoring | Sentry + Grafana/Prometheus + UptimeRobot | Full-stack visibility |
| Analytics | PostHog (self-hostable) | Funnels (search→book), feature usage, privacy-controllable |

## 7.2 Why not X?

- **React Native instead of Flutter?** Viable; choose it only if the hired team is much stronger in RN. Flutter's RTL + custom-design consistency wins for this product.
- **Laravel/Django backend?** Both fine; NestJS chosen to share TypeScript across all web surfaces and because the supplier-adapter/queue architecture maps cleanly. If the development company is a strong Laravel shop, Laravel + Horizon is an acceptable substitute — the architecture documents remain valid.
- **Microservices from day one?** No. A modular monolith ships Phase 1 months faster; module boundaries (see architecture doc) preserve the option to extract services later.
- **MySQL?** PostgreSQL preferred for JSONB, RLS, and pgvector; MySQL acceptable if the ops team requires it.

## 7.3 Internationalization rules (engineering-level)

- All user-visible strings in ICU message catalogs (`ar.json`, `en.json`); **no hardcoded strings**.
- Layouts written with logical properties (`start/end`, never `left/right`); Flutter `Directionality` + `EdgeInsetsDirectional`.
- Numbers: Western digits (0-9) by default even in Arabic UI (Libyan convention for prices/flight numbers); Hijri date display optional, Gregorian canonical.
- Bilingual data fields (`*_ar`/`*_en`) fall back gracefully (show other locale + badge) rather than blank.
- PDF templates per locale; WhatsApp templates registered per locale.
- Fonts: Arabic — IBM Plex Sans Arabic (UI) / Cairo (headings); Latin — Inter.

## 7.4 Repository layout (monorepo)

```
rihlati/
├── apps/
│   ├── mobile/          # Flutter
│   ├── web/             # Next.js customer site
│   ├── dashboard/       # React admin + agent + corporate (role-gated)
│   └── api/             # NestJS backend
├── packages/
│   ├── shared-types/    # API contracts (OpenAPI-generated clients)
│   ├── ui/              # shared React components (web + dashboard)
│   └── pdf-templates/   # HTML/CSS templates AR+EN
├── infra/               # Docker, IaC, CI
└── docs/                # this documentation
```

# 9 — Development Timeline & Cost Estimate

> Estimates assume a competent regional agency or hybrid team. Ranges reflect team seniority and location (North Africa / Turkey / Eastern Europe rates). All figures USD, excluding third-party running costs (§9.4).

## 9.1 Team plan

| Role | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| Product manager / analyst | 0.5 | 0.5 | 0.5 | 0.5 |
| UX/UI designer (bilingual AR/EN) | 1 | 0.5 | 0.5 | 0.5 |
| Flutter developer | 2 | 2 | 1 | 2 |
| Frontend (Next.js + dashboard) | 2 | 1.5 | 2 | 1.5 |
| Backend (NestJS) | 2 | 2 | 2 | 2 |
| AI engineer | 0.5 | 0.5 | 0.5 | 1 |
| QA engineer | 1 | 1 | 1 | 1 |
| DevOps (part-time) | 0.3 | 0.3 | 0.3 | 0.3 |
| **Total FTE** | **~9.3** | **~8.3** | **~7.8** | **~8.8** |

## 9.2 Timeline

```
Month:      1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18
Phase 1 MVP ████████████████████░
  Design & UX      ██████░
  Backend core     ─████████████░
  Apps & dashboard ───██████████████░
  WhatsApp/PDF/AI  ──────████████░
  QA + pilot       ────────────░████
Phase 2 Automation           ░████████████░
Phase 3 B2B                              ░██████████░
Phase 4 Smart                                     ░████████████░
```

| Phase | Duration | Calendar | Exit milestone |
|---|---|---|---|
| **P1 — MVP, engine-first** | **5–6 months**, sequenced per [13-execution-plan-core-mvp.md](13-execution-plan-core-mvp.md): **1a** Core Automation Backend (M1–M3) → **1b** Booking Flow Simulator (M3) → **1c** Basic Admin Dashboard (M3–M4) → **1d** internal pilot, ~50 cases (M4) → **1e** customer app + website (M4–M6) | M1–M6 | Gates: PR approval before code · simulator's 13 scenarios green before dashboard investment · pilot touchless-rate report before public app work finishes. Launch scope: automated booking pipeline + exception queue, passport OCR, visa readiness score with AI pre-check, WhatsApp outbound automation, auto-dispatched PDFs + Trip Wallet, payment auto-matching, AI planner + AI-drafted quotations, no-code controls v1 |
| **P2 — Automation** | 3–4 months | M6–M10 | Live flight/hotel APIs, gateway payments, wallet, eSIM, full notifications |
| **P3 — B2B** | 3 months | M10–M13 | Agent + corporate dashboards, commissions, monthly invoicing, loyalty basic |
| **P4 — Smart** | 3–4 months | M13–M17 | Full AI assistant, dynamic packages, loyalty tiers, flight tracking, advanced analytics |

Total to full platform: **~15–17 months**. The business operates commercially from month 6.

## 9.3 Development cost estimate

| Phase | Effort (person-months) | Regional agency ($4–6k/PM) | Premium team ($7–10k/PM) |
|---|---|---|---|
| P1 MVP | ~50 PM | **$200k – $300k** | $350k – $500k |
| P2 | ~30 PM | $120k – $180k | $210k – $300k |
| P3 | ~24 PM | $95k – $145k | $170k – $240k |
| P4 | ~32 PM | $130k – $190k | $225k – $320k |
| **Total** | **~136 PM** | **$545k – $815k** | $955k – $1.36M |

**Lean-start alternative:** a strong 5-person senior team can deliver a tighter MVP (drop basic AI to Phase 2, top-4 visa countries only, website read-only) in ~4 months for **$90k–$150k** at North-African rates. Recommended if budget is the constraint — the architecture here supports both paths.

## 9.4 Running costs (monthly, at launch scale)

| Item | Est. $/month |
|---|---|
| Cloud hosting (API, DB, Redis, staging) | 300 – 800 |
| Object storage + CDN | 50 – 150 |
| WhatsApp Business API (BSP fees + conversation charges) | 200 – 800 |
| Claude API (AI assistant + quotations) | 150 – 600 |
| Email/SMS | 50 – 200 |
| Google Maps | 50 – 300 |
| Monitoring/Sentry/analytics | 50 – 150 |
| Apple + Google developer accounts | ~12 |
| Flight/hotel API | usually per-booking fees, not fixed |
| **Total** | **~$850 – $3,000 / month** |

## 9.5 Key cost/schedule risks

1. **Local payment gateway availability** — start integration discovery in month 1; the manual-confirmation flow removes launch dependency.
2. **WhatsApp Business API approval** (business verification, display name) — begin Meta verification immediately; takes weeks.
3. **GDS/consolidator contracts** — commercial negotiation is often slower than the code; Duffel mitigates.
4. **Arabic QA** — budget explicit RTL/localization QA passes; this is the most commonly skipped and most visible quality issue.
5. **App store review** — plan 2–3 weeks buffer for first submissions (travel + payments category questions).

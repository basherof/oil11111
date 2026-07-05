# 6 — API Integrations

Principle: **never depend on one supplier.** Every external capability sits behind an internal adapter interface with a `manual` fallback, so the platform works even when a supplier is down or not yet contracted.

## 6.1 Integration matrix

| Capability | Recommended | Alternatives | Phase | Fallback |
|---|---|---|---|---|
| Flights | **Duffel** (modern REST, fast onboarding) | Amadeus Self-Service, Travelport, local consolidators in Tunis/Istanbul | 2 | Manual issuance by staff (MVP mode) |
| Hotels | **RateHawk (Emerging Travel Group)** — strong MENA/Turkey inventory, net rates | Hotelbeds, TBO Holidays | 2 | Manual booking with partner hotels |
| eSIM | **Airalo Partner API** | eSIM Go, Mobimatter | 2 | Manual QR delivery |
| Insurance | Regional insurer API (e.g., Tune Protect–style B2B) | Local Libyan insurer manual issuance | 2 | Manual PDF policy |
| Payments | **Local Libyan gateways: Sadad (LTT), Moamalat/Tadawul cards, Mobicash/Edfali wallets** — subject to availability assessment | Bank-transfer tracking (always on), cash at office, agent network | 1 (manual) / 2 (gateway) | Manual confirmation flow |
| WhatsApp | **WhatsApp Business Platform (Cloud API)** via Meta BSP (e.g., 360dialog, Twilio) | On-prem BSP | 1 | Deep links to normal WhatsApp + manual send |
| SMS | Regional aggregator covering Libyana/Almadar | — | 2 (optional) | Push + WhatsApp |
| Email | Postmark / SES | Mailgun | 1 | — |
| Maps | Google Maps Platform (Places, Static Maps, Embed) | OpenStreetMap/Mapbox | 1 basic / 2 full | Static map images |
| AI | **Claude API** (`claude-fable-5` for planning/quotations; `claude-haiku-4-5` for chat/classification) | Other LLM APIs — keep provider-agnostic orchestration layer | 1 | Scripted FAQ flows |
| Currency | exchangerate.host / OpenExchangeRates + manual admin override for LYD parallel rate | — | 2 | Admin-set rates (MVP) |
| Weather | OpenWeather | — | 4 | Omit |
| Push | Firebase Cloud Messaging (+ APNs) | — | 1 | — |
| Images | Licensed destination photo library + own media; optionally Unsplash API for guides | — | 1 | Curated static gallery |

## 6.2 WhatsApp Business — design notes

- **Outbound (templates, pre-approved per locale):** booking received, payment confirmed, ticket delivery (PDF), voucher delivery, quotation delivery, missing document, passport expiry, T-24h reminder, visa appointment, eSIM QR, payment reminder.
- **Inbound:** webhook → match `wa_phone` to user → attach to open thread → route to support queue; media (passport photos, receipts) auto-saved as `user_documents` with `uploaded_via='whatsapp'` pending staff classification.
- **Agent console:** support staff reply from the admin dashboard; every thread shows customer profile, active bookings, payment status, and documents alongside the conversation.
- **Compliance:** 24-hour customer-service window rules respected; templates used outside the window; opt-out honored.

## 6.3 Flight supplier adapter interface (illustrative)

```ts
interface FlightSupplierAdapter {
  search(criteria: FlightSearch): Promise<FareOffer[]>;      // manual adapter returns cached/on-request fares
  price(offerId: string): Promise<PricedOffer>;              // confirm price before payment
  book(offer: PricedOffer, pax: Passenger[]): Promise<SupplierPNR>;
  issue(pnr: string): Promise<TicketNumbers>;
  cancel(pnr: string): Promise<CancelResult>;
  fareRules(offerId: string): Promise<FareRules>;
}
// registered per feature-flag: flights.mode = 'manual' | 'duffel' | 'amadeus'
```

The `ManualAdapter` implements the same interface but creates staff tasks instead of API calls — this is what makes Phase 1 → Phase 2 a configuration change, not a rewrite.

## 6.4 Payment handling in Libya (MVP reality)

1. **Bank transfer:** customer sees company bank accounts (per bank), uploads receipt photo; finance officer matches and confirms; automatic receipt PDF issued.
2. **Cash at office / authorized agent:** staff record payment; printed + digital receipt.
3. **Wallet:** top-up via any confirmed method; instant payment from balance thereafter.
4. **Corporate invoice:** bookings accrue to a monthly invoice; payment recorded against invoice.
5. **Deposits/partial:** minimum deposit % per service type (admin setting); balance due date with automatic reminders.
6. **Gateway (Phase 2):** webhook-driven `payments.status` updates; reconciliation report against ledger daily.

## 6.5 Webhooks & events (inbound)

| Source | Events handled |
|---|---|
| WhatsApp BSP | message received, status (sent/delivered/read/failed) |
| Payment gateway | payment succeeded/failed/refunded |
| Duffel/Amadeus | order created, schedule change, cancellation |
| Hotel API | booking confirmed/amended/cancelled |
| eSIM API | order fulfilled (QR ready) |

All webhooks: signature verification, idempotency keys, dead-letter queue + admin alert on repeated failure.

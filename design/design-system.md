# Design System — Rihlati رحلتي

**Personality:** premium but accessible · trustworthy · local · calm · uncluttered.
**Rule of thumb:** if a screen needs explanation, redesign it. Target user: a Libyan customer who has never used a booking app.

## 1. Color

| Token | Hex | Use |
|---|---|---|
| `navy-900` | `#0B2545` | Primary brand, headers, dark surfaces |
| `navy-700` | `#13315C` | Secondary surfaces, gradients |
| `royal-500` | `#1D4E89` | Primary buttons, links, active states |
| `gold-400` | `#C9A227` | Premium accents, loyalty, "best value" labels, VIP |
| `turquoise-400` | `#2EC4B6` | Highlights, AI assistant identity, secondary CTAs |
| `sand-50` | `#F7F5F0` | App background (warm white) |
| `white` | `#FFFFFF` | Cards |
| `ink-900` | `#1A1D23` | Body text |
| `ink-500` | `#5B6472` | Secondary text |
| `success-500` | `#1E9E5A` | Confirmed, paid, ticket issued |
| `warning-500` | `#E0A100` | Pending, passport expiry warnings |
| `danger-500` | `#D64545` | **Errors and warnings only** — never decorative |

Status color mapping: draft `ink-500` · pending payment `warning` · payment received `royal` · processing/waiting supplier `turquoise` · confirmed/ticket issued/completed `success` · requires action `warning` · cancelled/failed `danger` · refunded `ink-500`.

## 2. Typography

| Script | Family | Notes |
|---|---|---|
| Arabic | **IBM Plex Sans Arabic** (UI), **Cairo** 700 (display/headings) | Generous line-height 1.7 for Arabic body |
| Latin | **Inter** | Matches Plex weights |

Scale (mobile): Display 28/34 · H1 22/28 · H2 18/24 · Body 15/24 · Caption 13/18 · Price 20/24 bold. Minimum body size 15px — many users are older travelers.

Numbers: Western digits (0-9) in both locales for prices, times, flight numbers.

## 3. Layout & RTL

- 4pt spacing grid; screen padding 20px; card radius 16px; button radius 12px; bottom-sheet radius 24px.
- **Logical directions only** (`start`/`end`). Arabic flips the entire layout: navigation drawer, back arrows (→ becomes ←), progress steps, card chevrons, sliders.
- Not mirrored in RTL: phone numbers, flight codes (TIP → IST), clocks, media controls, brand logo.
- Bottom navigation (5 items): Home · My Trips · **AI Planner (center, raised turquoise FAB)** · Support · Profile.
- One primary action per screen; primary button full-width, pinned above the keyboard/safe area.

## 4. Core components

| Component | Spec |
|---|---|
| **Service tile** (home) | 6 max: icon 28px in tinted circle, label, card 16px radius, subtle shadow `0 2px 12px rgba(11,37,69,.06)` |
| **Flight result card** | Airline logo+name row · big time pair with route line & stop dots · duration + baggage icons · fare labels (chips) · price right/end-aligned + "per person" · fee note "includes service fee" |
| **Label chips** | الأرخص Cheapest (green outline) · الأفضل قيمة Best value (gold fill) · الأسرع Fastest (turquoise) · مناسب للعائلات Family-friendly (soft blue) |
| **Status pill** | Dot + label, colored per status map; always visible on booking cards |
| **Hotel card** | 16:10 image, star row, guest score badge, distance chips (✈ 12km · 🏥 400m), price/night, free-cancel tag |
| **Step header** | Booking flow: numbered progress (١ الرحلة ٢ المسافرون ٣ الدفع ٤ التأكيد), fills royal-500 |
| **Passenger form** | Grouped card per traveler; "اختر من المسافرين المحفوظين / Pick saved traveler" chips on top; passport expiry inline warning banner (warning-500) |
| **Price breakdown** | Always: base + service fee + tax − discount = **Total**, total in Price type size; "estimated" watermark chip when unconfirmed |
| **WhatsApp bar** | Persistent entry: green WhatsApp pill on Support screen + floating on booking details |
| **AI option card** | Header Economy/Standard/Premium (Standard pre-highlighted gold "الأنسب Recommended"), flight+hotel rows, mini itinerary accordion, est. total, 4 action buttons |
| **Empty states** | Friendly illustration + one action ("لا رحلات بعد — خطط رحلتك الأولى مع المساعد الذكي") |

## 5. Tone of voice (microcopy)

- Arabic: warm, plain, respectful — «جاهزين نساعدك في كل خطوة». Avoid formal bureaucratic Arabic; light Libyan-friendly phrasing in marketing, MSA in documents/PDFs.
- Never blame the user in errors; always offer the next step + WhatsApp fallback.
- Prices honest: «السعر النهائي يشمل رسوم الخدمة» or «سعر تقريبي — يتأكد خلال ساعتين».

## 6. Accessibility & performance

- Contrast AA minimum; touch targets ≥ 48px; support OS font scaling to 130% without breakage.
- Skeleton loaders (no spinners > 300ms); optimistic UI on non-critical actions.
- Image budget: hero ≤ 120KB WebP; work beautifully on 3G — Libya-first performance.
- Offline: My Trips documents (tickets/vouchers/QRs) cached and viewable without connection.

## 7. PDF brand templates

Header: navy band + logo + gold rule. Body: bilingual sections or single-locale per document. Footer: office address, WhatsApp number, QR to booking status page. Fonts embedded (Plex Arabic + Inter). Documents: ticket, hotel voucher, quotation, visa checklist, invoice, receipt, trip plan, medical package, business package, corporate report.

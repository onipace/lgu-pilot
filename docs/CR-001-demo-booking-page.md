# CR-001: Demo Booking System

**Status:** DRAFT — Pending Approval
**Created:** 2026-08-12
**Type:** Feature (new page + API routes + admin dashboard + calendar)
**Risk:** MEDIUM (expanded scope — new DB models, Google Sheets API, calendar logic, admin page)
**Source:** User-initiated (dead CTA links on landing page)

---

## Step 1: INTAKE

### Problem Statement

All four "Book a Demo" buttons on the eSANGGUNI landing page (`src/app/page.tsx`) link to `/contact`, which returns a **404 — This page could not be found**. The primary call-to-action for converting landing page visitors into demo prospects is completely non-functional.

### Affected Buttons (4 instances in `src/app/page.tsx`)

| Line | Location | Current `href` |
|------|----------|----------------|
| 94–100 | Desktop navigation bar | `/contact` → 404 |
| 120–126 | Mobile menu | `/contact` → 404 |
| 171–177 | Hero section CTA | `/contact` → 404 |
| 321–327 | Bottom CTA section | `/contact` → 404 |

### Change Classification

- **Type:** `feature` (composite) — new pages, new API routes, new DB models, new admin dashboard, external API integration
- **Subtypes:** `schema` (3 new Prisma models) + `content` (booking page, admin page) + `integration` (Google Sheets API, hCaptcha)

---

## Step 2: IMPACT

### Blast Radius

| # | File | Impact | Action |
|---|------|--------|--------|
| 1 | `prisma/schema.prisma` | 3 new models | MODIFY — add `DemoBooking`, `DemoAvailability`, `DemoSlot` |
| 2 | `src/app/contact/page.tsx` | NEW — public booking page with calendar | CREATE |
| 3 | `src/app/api/book-demo/route.ts` | NEW — booking submission endpoint | CREATE |
| 4 | `src/app/api/demo-slots/route.ts` | NEW — fetch available slots for calendar | CREATE |
| 5 | `src/app/api/admin/bookings/route.ts` | NEW — admin CRUD for bookings | CREATE |
| 6 | `src/app/api/admin/availability/route.ts` | NEW — admin manages available slots | CREATE |
| 7 | `src/app/admin/bookings/page.tsx` | NEW — admin bookings dashboard | CREATE |
| 8 | `src/app/admin/availability/page.tsx` | NEW — admin availability/schedule config | CREATE |
| 9 | `src/components/admin/bookings-table.tsx` | NEW — reusable bookings table | CREATE |
| 10 | `src/components/contact/demo-calendar.tsx` | NEW — calendar date/time picker component | CREATE |
| 11 | `src/components/contact/hcaptcha-wrapper.tsx` | NEW — hCaptcha React wrapper | CREATE |
| 12 | `src/lib/email.ts` | Add booking notification + confirmation templates | MODIFY |
| 13 | `src/lib/google-sheets.ts` | NEW — Google Sheets API helper | CREATE |
| 14 | `src/lib/demo-availability.ts` | NEW — slot generation logic | CREATE |
| 15 | `src/app/admin/page.tsx` | Add "Demo Bookings" quick-access card | MODIFY |
| 16 | `src/middleware.ts` | Verify `/contact` is public (it is) | VERIFY |
| 17 | `package.json` | Add `@hcaptcha/react-hcaptcha`, `googleapis` | MODIFY |
| 18 | `.env.ecs` | Add `HCAPTCHA_SITE_KEY`, `HCAPTCHA_SECRET_KEY`, `GOOGLE_SHEETS_*`, `GOOGLE_SHEET_ID` | MODIFY |

### Risk Assessment

| Category | Score | Justification |
|----------|-------|---------------|
| Auth/Security | MEDIUM | Public form exposed to internet. Mitigated by hCaptcha + Zod validation + rate limiting. Admin pages already behind existing auth. |
| Data | LOW-MEDIUM | Collects PII (name, email, org, phone). Stored in PostgreSQL. No sensitive data beyond standard contact info. Google Sheets sync adds external data surface. |
| Payment | NONE | No payment involved. |
| External Dependencies | MEDIUM | Google Sheets API requires service account credentials. hCaptcha requires site/secret keys. Failure of either should degrade gracefully (not block booking). |
| Existing Features | LOW | Purely additive. No existing functionality modified except adding a quick-access card to admin dashboard. |
| **Overall** | **MEDIUM** | |

### Environment Parity

| Environment | URL | Status |
|-------------|-----|--------|
| Production (ECS) | esangguni.bayanaihan.net | Live |
| Sandbox | N/A | **No sandbox environment exists** |
| CI/CD | N/A | **No GitHub Actions pipelines exist** |

**Parity Verdict:** SINGLE-ENVIRONMENT. Deploy direct to production via `docker compose up -d --force-recreate --build` on ECS (established pattern).

### Existing Infrastructure (Reusable)

- **Nodemailer** — `src/lib/email.ts` already configured with SMTP
- **UI Components** — `button`, `card`, `input`, `textarea`, `dialog`, `tabs` from shadcn/ui with PILLAR design tokens
- **Admin Dashboard** — `/admin` page with quick-access cards, PILLAR styling, stats pattern
- **Admin Auth** — `esangguni_session` cookie, middleware protection on `/admin/*`
- **Contact Info** — `src/lib/data/site-config.json` has `contactEmail`, `contactPhone`, `address`
- **Prisma + PostgreSQL** — 19 existing tables, established migration pattern
- **Rate Limiting** — Existing in-memory pattern in auth routes

---

## Step 3: Implementation Proposal

### Architecture Overview

```
Landing Page (/)
  └─ "Book a Demo" → /contact
                        ├─ Contact form (name, email, org, etc.)
                        ├─ Calendar widget (pick date → pick available slot)
                        ├─ hCaptcha verification
                        └─ POST /api/book-demo
                              ├─ Validate (Zod + hCaptcha server verify)
                              ├─ Save to PostgreSQL (DemoBooking)
                              ├─ Append to Google Sheet (async, non-blocking)
                              └─ Send email notification to admin

Admin Dashboard (/admin)
  ├─ Quick Access → "Demo Bookings" card → /admin/bookings
  │     └─ Table: all bookings, filter by status, update status
  └─ Quick Access → "Availability" card → /admin/availability
        └─ Configure: business hours, blocked dates, slot duration
```

---

### WP1: Database Models (`prisma/schema.prisma`)

```prisma
// ========== DEMO BOOKING ==========

model DemoBooking {
  id              String    @id @default(uuid())
  fullName        String    @map("full_name")
  email           String
  organization    String
  position        String?
  phone           String?
  message         String?
  preferredDate   DateTime? @map("preferred_date")
  preferredSlot   String?   @map("preferred_slot")   // e.g. "10:00"
  status          String    @default("new")           // new, contacted, confirmed, completed, cancelled
  hcaptchaPassed  Boolean   @default(false) @map("hcaptcha_passed")
  sheetsSynced    Boolean   @default(false) @map("sheets_synced")
  sheetsError     String?   @map("sheets_error")
  adminNotes      String?   @map("admin_notes")
  contactedAt     DateTime? @map("contacted_at")
  confirmedAt     DateTime? @map("confirmed_at")
  completedAt     DateTime? @map("completed_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @default(now()) @updatedAt @map("updated_at")

  @@index([status])
  @@index([email])
  @@index([createdAt])
  @@map("demo_bookings")
}

model DemoAvailability {
  id            String   @id @default(uuid())
  dayOfWeek     Int      @map("day_of_week")   // 0=Sun, 1=Mon, ..., 6=Sat
  startTime     String   @map("start_time")     // "09:00"
  endTime       String   @map("end_time")       // "17:00"
  slotDuration  Int      @default(30) @map("slot_duration")  // minutes
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @default(now()) @updatedAt @map("updated_at")

  @@map("demo_availability")
}

model DemoBlockedDate {
  id        String   @id @default(uuid())
  date      DateTime @db.Date
  reason    String?
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([date])
  @@map("demo_blocked_dates")
}
```

**Design decisions:**
- `DemoAvailability` defines recurring weekly schedule (e.g., Mon-Fri 9am-5pm, 30-min slots)
- `DemoBlockedDate` overrides for holidays, PTO, etc.
- Available slots are computed at query time from availability rules minus existing bookings minus blocked dates — no need for a separate "slot" table
- `sheetsSynced` / `sheetsError` track Google Sheets sync status per booking for debugging

---

### WP2: Public Booking Page (`/contact`)

**Layout:** Two-column on desktop, stacked on mobile.

**Left column — Booking form:**
1. Full Name (required)
2. Email Address (required)
3. LGU / Organization (required)
4. Position / Role (optional)
5. Phone Number (optional)
6. **Calendar widget** — date picker showing next 14 days, then time slot grid for selected date
7. Message / Questions (optional textarea)
8. hCaptcha widget
9. "Request Demo" submit button

**Right column — Info panel:**
- "What you'll see in the demo" — brief overview of ELLA, OBRA, YALA, LIKHA, LINAW
- Contact info from `site-config.json`
- Response time expectation ("We'll confirm within 1 business day")

**Calendar widget behavior:**
- Fetch `GET /api/demo-slots?week=1` → returns available dates + slots
- Already-booked slots are greyed out
- Selecting a date shows available time slots as clickable chips
- Selected date + slot populate hidden form fields

**Success state:** Full-width confirmation card with booking summary and "What happens next" timeline.

---

### WP3: API Routes

#### `GET /api/demo-slots`

Returns available time slots for the next N days based on `DemoAvailability` rules, minus existing `DemoBooking` records and `DemoBlockedDate` entries.

**Response:**
```json
{
  "dates": [
    {
      "date": "2026-08-14",
      "dayLabel": "Thursday",
      "slots": ["09:00", "09:30", "10:00", "10:30", "14:00", "14:30"]
    },
    {
      "date": "2026-08-15",
      "dayLabel": "Friday",
      "slots": ["09:00", "09:30", "11:00"]
    }
  ]
}
```

#### `POST /api/book-demo`

**Request body:**
```json
{
  "fullName": "Juan Dela Cruz",
  "email": "juan@lgu.gov.ph",
  "organization": "Municipality of Example",
  "position": "SB Secretary",
  "phone": "(042) 123-4567",
  "preferredDate": "2026-08-14",
  "preferredSlot": "10:00",
  "message": "Interested in the ordinance drafting module",
  "hCaptchaToken": "P0_eyJ..."
}
```

**Behavior:**
1. Verify hCaptcha token server-side (`POST https://hcaptcha.com/siteverify`)
2. Validate all fields with Zod
3. Check slot is still available (not booked between form load and submit)
4. Save `DemoBooking` to PostgreSQL
5. Send email notification to admin (via `sendDemoBookingNotification()`)
6. Append row to Google Sheet (async, non-blocking — if Sheets API fails, booking still succeeds; `sheetsSynced` flag tracks this)
7. Return success response

**Graceful degradation:**
- If hCaptcha env vars are missing → skip captcha (allows dev/testing without keys)
- If Google Sheets credentials missing → skip Sheets sync (booking still works)
- If SMTP not configured → skip email (booking still works, admin sees it in dashboard)

#### `GET /api/admin/bookings`

Admin-only. Returns paginated bookings with filters (`?status=new&page=1&limit=20`).

#### `PATCH /api/admin/bookings/[id]`

Admin-only. Update booking status, admin notes.

#### `GET /api/admin/availability`

Admin-only. Returns current availability rules + blocked dates.

#### `PUT /api/admin/availability`

Admin-only. Upsert weekly schedule and blocked dates.

---

### WP4: Google Sheets Integration (`src/lib/google-sheets.ts`)

Uses the `googleapis` npm package with a **Service Account** (recommended for server-to-server, no user OAuth flow needed).

**Setup required (one-time, manual):**
1. Create a Google Cloud service account
2. Enable Google Sheets API
3. Download JSON key file
4. Share the target Google Sheet with the service account email (Editor access)
5. Store credentials in `.env.ecs` as `GOOGLE_SHEETS_CREDENTIALS` (JSON string) and `GOOGLE_SHEET_ID`

**What gets written:** Each booking appends a row with columns: Timestamp, Name, Email, Organization, Position, Phone, Preferred Date, Preferred Time, Message.

**Error handling:** If the Sheets API call fails, the booking is still saved to PostgreSQL. The `sheetsSynced` flag stays `false` and `sheetsError` logs the reason. Admin can retry from the dashboard later (future enhancement).

---

### WP5: Admin Bookings Dashboard (`/admin/bookings`)

**Layout:** Follows existing admin page patterns (PILLAR design tokens, card-based layout).

**Features:**
- Stats bar: Total bookings | New | Contacted | Confirmed | Completed | Cancelled
- Filterable table: status pills, date range, search by name/org/email
- Row actions: Update status dropdown, add admin notes (inline edit)
- Click row to expand full booking details
- Export to CSV button

**Quick Access card on `/admin`:**
- "Demo Bookings" card with Calendar icon, links to `/admin/bookings`
- Shows count badge of "new" bookings (same pattern as existing cards)

---

### WP6: Admin Availability Config (`/admin/availability`)

**Layout:** Simple form-based config page.

**Features:**
- Toggle each day of the week on/off
- For active days: set start time, end time, slot duration (dropdown: 15/30/45/60 min)
- Blocked dates: date picker to add/remove blocked dates with optional reason
- "Save Schedule" button → `PUT /api/admin/availability`
- Preview: shows computed slots for the next 7 days based on current config

---

### WP7: hCaptcha Integration

**Recommendation: hCaptcha (not reCAPTCHA)**

| Factor | hCaptcha | Google reCAPTCHA v3 | Turnstile (Cloudflare) |
|--------|----------|---------------------|----------------------|
| Privacy | GDPR/CCPA compliant, no tracking | Requires Google cookies, tracking concerns | Privacy-friendly but Cloudflare-locked |
| Government suitability | Best — privacy-first, EU-approved | Moderate — Google dependency | Good but ties to Cloudflare |
| Free tier | 50K verifications/month | 10K assessments/month (v3) | Unlimited |
| Integration complexity | Low — `@hcaptcha/react-hcaptcha` + server verify | Medium — score-based, needs threshold tuning | Low — similar to hCaptcha |
| Accessibility | Good — audio challenge | Moderate | Good |
| PH LGU context | No Google dependency (LGUs may use non-Chrome browsers) | Google ecosystem dependency | Requires Cloudflare (eSANGGUNI uses Cloudflare for DNS but not proxy) |

**Verdict: hCaptcha** — best fit for a government platform. Privacy-compliant, no Google dependency, generous free tier (50K/month is far more than this LGU site needs), and straightforward integration.

**Implementation:**
- Client: `<HCaptcha sitekey={SITE_KEY} onVerify={setToken} />` in the booking form
- Server: `POST https://hcaptcha.com/siteverify` with `{ secret, response: token, remoteip }` in the API route
- Graceful degradation: if `HCAPTCHA_SITE_KEY` / `HCAPTCHA_SECRET_KEY` env vars are missing, captcha is silently skipped (dev mode)

---

### WP8: Email Templates (`src/lib/email.ts`)

Add two new functions following the existing branded template pattern:

1. **`sendDemoBookingNotification(booking)`** — sends to admin email (`site-config.json` `contactEmail`) with all booking details, formatted in the eSANGGUNI branded email style
2. **`sendDemoConfirmation(booking)`** — sends to the prospect confirming receipt, with "What happens next" timeline

---

### Files Summary

| # | File | Action | Est. Effort |
|---|------|--------|-------------|
| 1 | `prisma/schema.prisma` | MODIFY — add 3 models | 30 min |
| 2 | `src/app/contact/page.tsx` | CREATE — booking page with calendar | 3–4 hrs |
| 3 | `src/components/contact/demo-calendar.tsx` | CREATE — calendar/slot picker | 2–3 hrs |
| 4 | `src/components/contact/hcaptcha-wrapper.tsx` | CREATE — hCaptcha component | 30 min |
| 5 | `src/app/api/book-demo/route.ts` | CREATE — booking endpoint | 1.5 hrs |
| 6 | `src/app/api/demo-slots/route.ts` | CREATE — slot availability endpoint | 1 hr |
| 7 | `src/lib/demo-availability.ts` | CREATE — slot computation logic | 1 hr |
| 8 | `src/lib/google-sheets.ts` | CREATE — Google Sheets helper | 1 hr |
| 9 | `src/app/admin/bookings/page.tsx` | CREATE — admin bookings dashboard | 2–3 hrs |
| 10 | `src/app/admin/availability/page.tsx` | CREATE — admin schedule config | 1.5–2 hrs |
| 11 | `src/app/api/admin/bookings/route.ts` | CREATE — admin booking CRUD | 1 hr |
| 12 | `src/app/api/admin/availability/route.ts` | CREATE — admin availability CRUD | 1 hr |
| 13 | `src/components/admin/bookings-table.tsx` | CREATE — reusable table component | 1 hr |
| 14 | `src/app/admin/page.tsx` | MODIFY — add quick-access card | 15 min |
| 15 | `src/lib/email.ts` | MODIFY — add 2 email templates | 1 hr |
| 16 | `package.json` | MODIFY — add deps | 5 min |
| 17 | `.env.ecs` | MODIFY — add new env vars | 5 min |

**Total estimated effort: 18–24 hours** (2.5–3 working days)

---

## Deployment Plan

1. Implement all WPs locally
2. Run Prisma migration: `npx prisma migrate dev --name add-demo-booking`
3. Test on local dev server (`npm run dev`)
4. Build Docker image and deploy to ECS: `docker compose -f docker-compose.vps.yml up -d --force-recreate --build`
5. Run Prisma migration on ECS: `docker exec esangguni-pilot npx prisma migrate deploy`
6. Verify live at `esangguni.bayanaihan.net/contact`
7. Test: form submission, calendar slot selection, hCaptcha, admin dashboard, Google Sheets sync
8. Configure env vars on ECS (`.env.ecs`): hCaptcha keys, Google Sheets credentials

### Prerequisites (user action required before deploy)

- [ ] Register at [hCaptcha Dashboard](https://dashboard.hcaptcha.com) → get Site Key + Secret Key
- [ ] Create Google Cloud service account + enable Sheets API → download JSON key
- [ ] Create target Google Sheet and share with service account email

---

## MAINTAIN Rule Compliance (Pre-Implementation)

```
RULE COMPLIANCE — MAINTAIN (Rules 27-32)
  Rule 27  [N/A]      evidence: No CI/CD pipeline; manual compose deploy (current pattern)
  Rule 28  [PASS]     evidence: Blast radius enumerated — 17 files, 3 new DB models, 2 external APIs
  Rule 29  [N/A]      evidence: No existing test suite to regress against
  Rule 30  [PENDING]  evidence: Awaiting user approval (MEDIUM risk → single approval)
  Rule 31  [N/A]      evidence: No git repo initialized
  Rule 32  [N/A]      evidence: Single environment (production only)
  Verdict: READY TO BUILD — pending user approval + prerequisite credentials
```

---

## Decision Required

**Approve to proceed?** This is a significant feature build (17 files, ~20 hrs) but entirely additive — no existing features are modified. The calendar, admin dashboard, Google Sheets, and hCaptcha are all self-contained additions that degrade gracefully if external credentials are not yet configured.

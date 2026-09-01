# CR-001 Change Log

**Date:** 2026-08-12
**Purpose:** Implement Demo Booking System for eSANGGUNI landing page
**Backup location:** QoderWork workspace backup-cr001/

## Files Backed Up (pre-change)
| Original | Backup |
|----------|--------|
| prisma/schema.prisma | schema.prisma.bak |
| src/lib/email.ts | email.ts.bak |
| src/app/admin/page.tsx | admin-page.tsx.bak |
| package.json | package.json.bak |
| src/middleware.ts | middleware.ts.bak |

## Files Created (new)
- src/app/contact/page.tsx — Public booking page
- src/components/contact/demo-calendar.tsx — Calendar/slot picker
- src/components/contact/hcaptcha-wrapper.tsx — hCaptcha component
- src/app/api/book-demo/route.ts — Booking submission endpoint
- src/app/api/demo-slots/route.ts — Slot availability endpoint
- src/app/api/admin/bookings/route.ts — Admin booking CRUD
- src/app/api/admin/availability/route.ts — Admin availability CRUD
- src/app/admin/bookings/page.tsx — Admin bookings dashboard
- src/app/admin/availability/page.tsx — Admin schedule config
- src/components/admin/bookings-table.tsx — Reusable bookings table
- src/lib/google-sheets.ts — Google Sheets API helper
- src/lib/demo-availability.ts — Slot computation logic

## Files Modified
- prisma/schema.prisma — Added DemoBooking, DemoAvailability, DemoBlockedDate models
- src/lib/email.ts — Added sendDemoBookingNotification() + sendDemoConfirmation()
- src/app/admin/page.tsx — Added "Demo Bookings" quick-access card
- package.json — Added @hcaptcha/react-hcaptcha, googleapis

## Files Verified Unchanged (AI modules — zero impact)
- src/app/ella/page.tsx
- src/app/obra/page.tsx
- src/app/yala/page.tsx
- src/app/likha/page.tsx
- src/app/linaw/page.tsx
- src/middleware.ts (verified: /contact not in PROTECTED_PATHS)

## Rollback Procedure
1. Restore backed-up files from backup-cr001/ to original locations
2. Remove all newly created files listed above
3. Run `npm install` to revert package.json changes
4. Rebuild Docker image: `docker compose -f docker-compose.vps.yml up -d --force-recreate --build`

## Deployment Log

**Deployed:** 2026-09-01
**Environment:** Alibaba Cloud ECS (8.220.189.33)
**Container:** esangguni-pilot (rebuilt)
**URL:** https://esangguni.bayanaihan.net

### Database Migration
- 3 tables created via SQL (Prisma CLI not available in standalone container):
  - `demo_bookings` — booking records with status tracking
  - `demo_availability` — weekly schedule rules
  - `demo_blocked_dates` — date overrides (holidays/PTO)
- 3 indexes created on demo_bookings (status, email, created_at)

### Verification Results
| Check | Status |
|-------|--------|
| /contact page | 200 OK |
| /api/demo-slots | 200 OK (empty — no availability configured yet) |
| User login (xander.mendoza@q101.ai) | PASS |
| /ella (AI module) | 302 redirect (auth required — unchanged) |
| /obra (AI module) | 302 redirect (auth required — unchanged) |
| /likha (AI module) | 302 redirect (auth required — unchanged) |
| /linaw (AI module) | 302 redirect (auth required — unchanged) |
| /yala (AI module) | 302 redirect (auth required — unchanged) |

### Pending Configuration (requires user action)
- hCaptcha keys (NEXT_PUBLIC_HCAPTCHA_SITE_KEY, HCAPTCHA_SECRET_KEY)
- Google Sheets credentials (GOOGLE_SHEETS_CREDENTIALS, GOOGLE_SHEET_ID)
- Admin availability schedule (configure at /admin/availability)

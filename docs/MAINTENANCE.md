# eSANGGUNI / lgu-pilot — Maintenance Log

**Repo:** https://github.com/onipace/lgu-pilot
**Live URL:** https://esangguni.bayanaihan.net
**ECS Host:** 8.220.189.33 (ssh alias `ecs`)
**Deploy directory:** `/opt/qoder-deployments/lgu-pilot`
**Docker Compose project name:** `esangguni-pilot` (legacy — always use `-p esangguni-pilot` when running docker compose)
**Containers:** `esangguni-pilot` (app, port 3070), `esangguni-postgres` (PostgreSQL 16)

---

## Table of Contents

- [Session 2026-09-01 — CR-001 + Chat Fix](#session-2026-09-01)
- [Troubleshooting Playbook](#troubleshooting-playbook)
- [Deployment Runbook](#deployment-runbook)
- [Rollback Procedure](#rollback-procedure)
- [Environment Variables Reference](#env-reference)
- [Database Reference](#database-reference)

---

## Session 2026-09-01 {#session-2026-09-01}

### Commits (chronological)

| SHA | Title | Author context |
|-----|-------|----------------|
| `3b05ef9` | feat: CR-001 demo booking system + LIKHA/LINAW updates | Full booking page, admin dashboards, hCaptcha, Google Sheets, 3 Prisma models |
| `fc68a78` | fix: update contact details on booking page to Q101 AI office | site-config.json: xander.mendoza@q101.ai / +639975309103 / QCGC EDSA |
| `c6a2090` | fix: chat route crashes when history undefined and LightRAG unavailable | Graceful degradation for /api/chat |

### What was built (CR-001 — Demo Booking System)

**Files created (12 new files):**
- `src/app/contact/page.tsx` — Public booking page with two-column layout (form + info panel)
- `src/components/contact/demo-calendar.tsx` — Date strip + slot picker (14-day rolling)
- `src/components/contact/hcaptcha-wrapper.tsx` — hCaptcha React component with dev-mode skip
- `src/app/api/book-demo/route.ts` — POST handler: rate limit, captcha verify, DB save, email + Sheets sync
- `src/app/api/demo-slots/route.ts` — GET available slots for calendar
- `src/app/api/admin/bookings/route.ts` — GET (paginated list) + PATCH (status/notes update)
- `src/app/api/admin/availability/route.ts` — GET + PUT for weekly schedule rules
- `src/app/admin/bookings/page.tsx` — Admin dashboard with stats bar, filters, search, CSV export
- `src/app/admin/availability/page.tsx` — Toggle days, set hours, add blocked dates, live preview
- `src/components/admin/bookings-table.tsx` — Reusable table with inline status dropdown + notes
- `src/lib/google-sheets.ts` — Google Sheets API helper (graceful no-op when creds missing)
- `src/lib/demo-availability.ts` — Slot computation: rules minus bookings minus blocked dates

**Files modified:**
- `prisma/schema.prisma` — Added 3 new models: `DemoBooking`, `DemoAvailability`, `DemoBlockedDate`
- `src/lib/email.ts` — Added `sendDemoBookingNotification()` + `sendDemoConfirmation()` templates
- `src/app/admin/page.tsx` — Added "Demo Bookings" quick-access card
- `src/lib/data/site-config.json` — Updated contact details
- `package.json` — Added `@hcaptcha/react-hcaptcha`, `googleapis`

### Backup locations

| Location | Contents |
|----------|----------|
| Local workspace `backup-cr001/` | Pre-CR-001 versions of 5 modified files |
| ECS `/opt/qoder-deployments/lgu-pilot/docker-compose.yml.bak-cr001` | Pre-CR-001 compose config |
| GitHub `onipace/lgu-pilot` @ `3b05ef9` | Full CR-001 code |

### Isolation verification (AI modules untouched)

CR-001 was verified to have zero references in AI module files (ELLA/OBRA/YALA/LIKHA/LINAW) — see `docs/CR-001-CHANGELOG.md` for the verification report.

---

## Troubleshooting Playbook {#troubleshooting-playbook}

### Symptom: "I encountered a connection error. Please check your internet connection and try again."

**Where this appears:** ELLA, OBRA, YALA chat interfaces
**Actual HTTP status:** 500 (client shows generic "connection error" text)

**Root causes to check (in order):**

1. **`history` undefined in request body** (fixed in `c6a2090`)
   - Location: `src/app/api/chat/route.ts` line 100
   - Symptom: `TypeError: Cannot read properties of undefined (reading 'filter')`
   - Fix: `const history = body.history || []`
   - Verify in ECS: `docker logs esangguni-pilot --tail 20 | grep filter`

2. **OpenRouter key invalid** — 401 "User not found"
   - Symptom in logs: `Chat API error: Error: 401 Insufficient credits` or `401 User not found`
   - Check: `docker exec esangguni-pilot node -e 'fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+process.env.OPENROUTER_API_KEY},body:JSON.stringify({model:"openai/gpt-3.5-turbo",messages:[{role:"user",content:"hi"}]})}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d)))'`
   - Fix: Update key in `.env` AND `.env.ecs`, then rebuild

3. **OpenRouter credits exhausted** — 402 "Insufficient credits"
   - Fix: Top up at https://openrouter.ai/settings/credits — no rebuild needed

4. **LightRAG service down** (fixed in `c6a2090`)
   - Symptom in logs: `[LightRAG] Service unavailable: fetch failed`
   - ECS has no LightRAG container (was on VPS only). Chat now gracefully continues without RAG.
   - If you deploy LightRAG later, add `LIGHTRAG_SERVICE_URL` to `.env`

5. **Prisma logging errors** — non-fatal but noisy
   - Symptom: `[logger] logChatMessage failed: PrismaClientValidationError`
   - Cause: schema field mismatch (usually nullable vs required)
   - Fix: Adjust `interaction_logs` table columns or the code's `logChatMessage` call

### Symptom: 404 on `/contact`

**Cause:** Booking page (CR-001) not yet deployed
**Fix:** Pull latest source from `onipace/lgu-pilot` and rebuild

### Symptom: `/api/demo-slots` returns empty `{"dates":[]}`

**Cause:** No `DemoAvailability` rows configured
**Fix:** Log in as admin, go to `/admin/availability`, configure weekly schedule

### Symptom: Login returns 500 "Can't reach database server"

**Cause:** Container can't reach Postgres (network or DATABASE_URL issue)
**Fix:**
```bash
ssh ecs
cd /opt/qoder-deployments/lgu-pilot
docker exec esangguni-pilot env | grep DATABASE_URL
# Expected: postgresql://esangguni:PASS@esangguni-postgres:5432/esangguni
docker exec esangguni-pilot ping -c 2 esangguni-postgres
```

### Symptom: Landing page links to old subdomains (`/ella` broken)

**Cause:** `workshop-config.ts` uses env vars with subdomain URLs
**Fix:** Hardcode path-based hrefs (`/ella`, `/obra`, etc.) — already applied on ECS. Rebuild after tarball deploy.

---

## Deployment Runbook {#deployment-runbook}

### Standard deploy (ECS)

```bash
# 1. Create tarball locally (excludes node_modules, .next, .git)
cd "C:\Users\Emil V. Capino\DATA\Qoder\ESANGGUNI\lgu-pilot-platform"
tar --exclude='node_modules' --exclude='.next' --exclude='.git' \
    -czf /tmp/esangguni-deploy.tar.gz .

# 2. Upload to ECS
scp -O /tmp/esangguni-deploy.tar.gz ecs:/tmp/

# 3. Extract, sync (preserve .env and docker-compose)
ssh ecs "mkdir -p /tmp/deploy && tar -xzf /tmp/esangguni-deploy.tar.gz -C /tmp/deploy && \
    rsync -a --exclude='.env*' --exclude='docker-compose*.yml' \
    /tmp/deploy/ /opt/qoder-deployments/lgu-pilot/"

# 4. Rebuild + recreate (MUST use -p esangguni-pilot — legacy project name)
ssh ecs "cd /opt/qoder-deployments/lgu-pilot && \
    docker compose -p esangguni-pilot up -d --force-recreate --build"

# 5. Verify
curl -s -o /dev/null -w "%{http_code}\n" https://esangguni.bayanaihan.net/api/health
```

### Single-file hotfix deploy

```bash
# Example: fix chat/route.ts
scp -O src/app/api/chat/route.ts ecs:/tmp/chat-route.ts
ssh ecs "cp /tmp/chat-route.ts /opt/qoder-deployments/lgu-pilot/src/app/api/chat/route.ts && \
    cd /opt/qoder-deployments/lgu-pilot && \
    docker compose -p esangguni-pilot up -d --force-recreate --build esangguni"
```

### Env var changes only

```bash
# Edit .env or .env.ecs, then restart (no rebuild needed unless NEXT_PUBLIC_*)
ssh ecs "docker compose -p esangguni-pilot restart esangguni"

# BUT: NEXT_PUBLIC_* vars are baked at build time — must rebuild:
ssh ecs "cd /opt/qoder-deployments/lgu-pilot && docker compose -p esangguni-pilot up -d --force-recreate --build"
```

### Database migrations (Prisma CLI not in standalone container)

The Next.js standalone build does NOT include `npx prisma`. Run migrations via raw SQL:

```bash
ssh ecs "docker exec esangguni-postgres psql -U esangguni -d esangguni -c \"YOUR SQL HERE\""
```

Example: create demo_bookings table (see CR-001 in git log for full SQL).

### Verifying contact info updates (site-config.json)

`site-config.json` is imported statically and **inlined at Next.js build time**. Editing it on the host alone does nothing. Must rebuild:

```bash
ssh ecs "cd /opt/qoder-deployments/lgu-pilot && docker compose -p esangguni-pilot up -d --force-recreate --build esangguni"
```

---

## Rollback Procedure {#rollback-procedure}

### To previous commit

```bash
cd "C:\Users\Emil V. Capino\DATA\Qoder\ESANGGUNI\lgu-pilot-platform"
git log --oneline  # find the SHA to roll back to
git checkout <SHA>
# then follow standard deploy above
```

### To previous Docker image (ECS-side)

Docker keeps old image layers. To list and reuse:

```bash
ssh ecs "docker images esangguni-pilot --format 'table {{.ID}}\t{{.CreatedAt}}\t{{.Tag}}'"
# Then: docker compose -p esangguni-pilot up -d esangguni with --image flag or edit compose
```

### Nuclear: restore from workspace backup

```bash
# From QoderWork workspace:
#   backup-cr001/ has pre-CR-001 versions of modified files
# Restore each file, then deploy
```

---

## Environment Variables Reference {#env-reference}

**Location on ECS:** `/opt/qoder-deployments/lgu-pilot/.env` and `.env.ecs` (both must be updated together)

| Variable | Purpose | When required |
|----------|---------|---------------|
| `OPENROUTER_API_KEY` | LLM API access for ELLA/OBRA/YALA | Always |
| `LLM_MODEL` | Which OpenRouter model to use | Always (default qwen3-235b-a22b or per-module) |
| `DATABASE_URL` | Postgres connection | Always |
| `POSTGRES_PASSWORD` | Postgres auth | Always |
| `SMTP_HOST/PORT/USER/PASS` | Email sending | Optional — degrades gracefully |
| `NEXT_PUBLIC_ESANGGUNI_URL` | Base URL for emails | Optional — path-based deploy uses `/` |
| `HCAPTCHA_SECRET_KEY` | Server-side captcha verify | Optional — skip if unset |
| `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` | Client captcha widget | Optional — skip if unset |
| `GOOGLE_SHEETS_CREDENTIALS` | JSON string of service account key | Optional — skip if unset |
| `GOOGLE_SHEET_ID` | Target Google Sheet for booking rows | Optional — skip if unset |
| `NOTIFY_EMAIL` | Booking notifications recipient | Optional — falls back to SMTP_USER |
| `LIGHTRAG_SERVICE_URL` | External LightRAG endpoint | Optional — CR-001 chat fix tolerates absence |

---

## Database Reference {#database-reference}

**Postgres instance:** `esangguni-postgres` (in Docker network)
**Database:** `esangguni`
**User:** `esangguni`

### Tables (as of 2026-09-01)

**Auth:**
- `admin_users` — id TEXT PK (uuid), username, password_hash, role (CHECK)
- `admin_sessions` — cookie-backed admin sessions
- `users` — id TEXT PK, email UNIQUE, password_hash, status (pending/approved/rejected)
- `user_sessions` — cookie-backed user sessions

**Workshop/analytics:**
- `workshop_sessions`, `participant_sessions`, `interaction_logs`

**Knowledge base:**
- `kb_documents`, `kb_index_runs`

**Infrastructure:**
- `ecs_instances`, `lgu_deployments`

**LIKHA (archive):**
- `archived_ordinances`, `classifications`, `amendment_links`

**LINAW (codification):**
- `linaw_ordinances`, `codification_records`, `ordinance_relationships`, `code_volumes`

**Audit:**
- `agent_decisions`

**Demo booking (CR-001):**
- `demo_bookings` — id TEXT PK, fullName, email, organization, status, sheets_synced flag
- `demo_availability` — day_of_week (0-6), start_time, end_time, slot_duration
- `demo_blocked_dates` — date UNIQUE, reason

### Quick DB inspection

```bash
# List tables
ssh ecs "docker exec esangguni-postgres psql -U esangguni -d esangguni -c '\dt'"

# Count rows in a table
ssh ecs "docker exec esangguni-postgres psql -U esangguni -d esangguni -c 'SELECT COUNT(*) FROM demo_bookings'"

# View recent bookings
ssh ecs "docker exec esangguni-postgres psql -U esangguni -d esangguni -c 'SELECT created_at, full_name, email, status FROM demo_bookings ORDER BY created_at DESC LIMIT 10'"

# Configure availability via SQL
ssh ecs "docker exec esangguni-postgres psql -U esangguni -d esangguni -c \"INSERT INTO demo_availability (id,day_of_week,start_time,end_time,slot_duration,is_active,created_at,updated_at) VALUES (gen_random_uuid()::text, 1, '09:00', '17:00', 30, true, NOW(), NOW())\""
```

### Password hashing

The app uses Node's built-in crypto. To create a user manually:

```bash
# Generate hash inside container
ssh ecs "docker exec esangguni-pilot node -e 'var c=require(\"crypto\"),s=c.randomBytes(16).toString(\"hex\"),h=c.scryptSync(\"YourPassword\",s,64).toString(\"hex\");process.stdout.write(s+\":\"+h)'"

# Insert user with that hash
ssh ecs "docker exec esangguni-postgres psql -U esangguni -d esangguni -c \"INSERT INTO users (id, email, password_hash, full_name, lgu_name, province, status, login_count, created_at, updated_at) VALUES (gen_random_uuid()::text, 'user@example.com', '<PASTE_HASH>', 'Full Name', 'Org', 'Province', 'approved', 0, NOW(), NOW())\""
```

---

## Contact

**Owner:** Emil V. Capino (GitHub: `onipace`)
**Site admin contact:** xander.mendoza@q101.ai / +639975309103
**Office:** 8th Flr., GCGC EDSA cor. Aurora Blvd., Quezon City, 2nd District NCR

---

## Related Documents

- [`docs/CR-001-demo-booking-page.md`](./CR-001-demo-booking-page.md) — Full CR-001 change request plan
- [`docs/CR-001-CHANGELOG.md`](./CR-001-CHANGELOG.md) — CR-001 implementation + deployment log
- [`docs/PILLAR-Documentation.md`](./PILLAR-Documentation.md) — Broader PILLAR architecture context
- [`docs/POSTGRES-MIGRATION-SPEC.md`](../POSTGRES-MIGRATION-SPEC.md) — Prisma/Postgres migration spec

---

*Document maintained by QoderWork. Update this file after every production change.*

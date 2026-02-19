# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SQLpet / PawShelter (ÚtulekOS)** — a cloud-based animal shelter management system (DMS) targeting small Czech shelters with global market ambitions. The full specification lives in `claude_pet.txt` (Czech language). Code, variables, and DB names are in English; UI text goes through i18n (cs + en).

## Tech Stack

- **Backend:** Python FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, Argon2 (auth), PyJWT
- **Frontend (planned):** Next.js 14+ (App Router), TypeScript, Tailwind, shadcn/ui, TanStack Query
- **Worker (planned):** Celery + Celery Beat, Redis broker
- **Database:** PostgreSQL 16+, full-text search + pg_trgm
- **Storage:** S3-compatible (MinIO in dev)
- **Infrastructure:** Docker Compose

## Repository Structure

```
/apps/api/          → FastAPI backend (Python)
  src/app/
    main.py         → FastAPI app entry point
    api/routes/     → Route modules (currently: health.py)
    core/config.py  → pydantic-settings based config
    db/session.py   → SQLAlchemy engine & session factory
/apps/web/          → Next.js frontend (planned)
/apps/worker/       → Celery worker (planned)
/packages/shared/   → Shared types, i18n keys (planned)
/infra/             → docker-compose.yml (currently PostgreSQL only)
/docs/              → Product docs, ADRs (planned)
/seed/              → Seed data scripts (planned)
```

## Commands

### Start infrastructure
```
docker-compose -f infra/docker-compose.yml up -d
```
PostgreSQL runs on port 5432 (db: `petdb`, user: `pet`, password: `pet`).

### Run the API
```
cd apps/api
pip install -r requirements.txt
uvicorn src.app.main:app --reload
```

### Run tests (when added)
```
cd apps/api
pytest
```

### Alembic migrations

**CRITICAL: There are TWO migration directories. Only ONE is used by alembic.**

- `apps/api/alembic.ini` has `script_location = migrations` → alembic reads from `apps/api/migrations/versions/`
- `apps/api/alembic/versions/` is a **dead directory** — alembic does NOT read from it
- **Always create and edit migration files in `apps/api/migrations/versions/`**
- Never create migrations in `apps/api/alembic/versions/` — they will be silently ignored

Create a new migration:
```
cd apps/api
alembic revision -m "describe_change"   # creates in migrations/versions/
```

Run migrations locally (uses local DB):
```
cd apps/api
alembic upgrade head
```

Run migrations against Railway production:
```
cd apps/api
railway run alembic upgrade head
```

### Railway Pre-deploy

Railway má predeploy hook kde lze spouštět příkazy před deployem. Aktuálně nastaveno na:
```
alembic upgrade head
```

**Tipy pro migrace:**
- Před commitem vždy ověř chain: `python -c "from alembic.config import Config; from alembic.script import ScriptDirectory; cfg = Config('alembic.ini'); script = ScriptDirectory.from_config(cfg); print('Heads:', script.get_heads())"`
- Jeden head = vpořádku, více headů = oprav chain
- Problémy s migracemi řeš lokálně: spusť `alembic upgrade head` a otestuj
- Po opravě chainu pushni a nech predeploy spustit

Check current DB version:
```
cd apps/api
railway run alembic current
```

### Scripts (apps/api/scripts/)

**CRITICAL: When writing new scripts, always use `DATABASE_URL_ASYNC` NOT `DATABASE_URL`!**

```python
# Wrong - will fail on Railway
database_url = settings.DATABASE_URL

# Correct - works on Railway
database_url = settings.DATABASE_URL_ASYNC
```

Other scripts use this pattern:
- `sync_tables.py`
- `create_missing_tables.py`
- `generate_thumbnails.py`
- `seed_breeds_simple.py`
- `seed_breeds_from_images.py`
- `import_default_images.py`
- `import_default_images_local.py`
- `backfill_default_images.py` ← example of correct usage

Run scripts locally:
```
cd apps/api
python scripts/script_name.py
```

Run scripts on Railway:
```
cd apps/api
railway run python scripts/script_name.py
```

## CLI Tools & Deployment Debugging

### Railway CLI Setup

**Check if logged in:**
```bash
railway whoami
```

**If not logged in, user must run (requires browser OAuth):**
```bash
railway login
```
Note: `railway login` opens a browser for OAuth. Claude Code cannot complete this interactively - user must run it in their terminal.

**Link project to directory:**
```bash
cd apps/api
railway link -p joyful-elegance -e production
```

**Check deployment logs:**
```bash
cd apps/api
railway logs --tail 50
```

**Check deployment status:**
```bash
railway status
```

**Common issues:**
- If `railway status` shows "Service: None", need to link service with `railway service <name>`
- If getting 404 from Railway URL with `x-railway-fallback: true` header, app is not running (check logs for crash/build failure)
- For monorepo: Railway **Root Directory** must be set to `apps/api` in dashboard Settings

### Vercel CLI Setup

**Check if logged in:**
```bash
vercel whoami
```

**If not logged in, user must run:**
```bash
vercel login
```

**Check deployments:**
```bash
cd apps/web
vercel ls
vercel logs
```

### Debugging Deployment Issues

**When login fails with CORS errors:**
1. Check if Railway API is running: `curl -I https://joyful-elegance.up.railway.app/health`
   - Look for `x-railway-fallback: true` → means app crashed/not running
2. Check Railway logs: `railway logs --tail 50` (if linked) or Railway Dashboard
3. Common causes:
   - Missing `main.py` in root (Railpack expects it)
   - Import errors (missing files not committed to git)
   - Database connection failures (wrong DATABASE_URL)
   - Missing environment variables

**Railway deployment checklist:**
- Root Directory: `apps/api` (for monorepo)
- Start Command: `uvicorn src.app.main:app --host 0.0.0.0 --port $PORT` (or use `main.py` in root)
- Environment variables: DATABASE_URL, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
- All imported files must be committed to git (Railway pulls from GitHub)

**CORS issues:**
- Backend must have `CORSMiddleware` with Vercel domain in `allow_origins`
- Check CORS headers in response: `curl -I -H "Origin: https://web-theta-peach-77.vercel.app" https://joyful-elegance.up.railway.app/auth/login`

### Deployment Flow

1. Make code changes
2. `git commit && git push`
3. GitHub triggers auto-deploy:
   - Railway: Builds & deploys API (~2-5 min)
   - Vercel: Builds & deploys frontend (~1-2 min)
4. Check deployment status:
   - Railway: `railway logs` or dashboard
   - Vercel: `vercel ls` or dashboard

## CORS Configuration

Configured in `apps/api/src/app/main.py` with `CORSMiddleware`:
- Static allowed origins: localhost:3000/5173 + known production Vercel URLs
- Regex: `https://.*\.vercel\.app` — covers all Vercel preview deployments automatically
- Env var: set `CORS_ORIGINS=https://my-domain.com` (comma-separated) in Railway to add origins without code changes

### CORS error troubleshooting
CORS errors are almost always a symptom of the backend crashing — the error response has no CORS headers:
1. `curl -I https://sqlpet-production.up.railway.app/health`
   - If `x-railway-fallback: true` → app is not running; check `railway logs --tail 50`
2. If the app is running but CORS still fails, add the origin to `CORS_ORIGINS` env var in Railway dashboard
3. Preflight (`OPTIONS`) is handled by `allow_methods=["*"]` — no changes needed

## Architecture Principles (from spec)

- **Multi-tenant from day one:** Every table has `organization_id` (FK). API must enforce tenant isolation — users only see their org's data.
- **UUID primary keys** on all tables.
- **RBAC:** 7 role templates (admin, manager, vet_staff, caretaker, volunteer, foster, readonly). Permission keys are strings. Roles are per-organization.
- **Audit logging:** All create/update/delete on key entities must write to `audit_logs`.
- **Domain services pattern:** Business logic in dedicated services (intakeService, medicalService, kennelService), not scattered in routes.
- **Status changes** go through a single function that writes audit + timeline event.
- **AI is optional:** All AI features are behind feature flags. System works fully without API keys.
- **Offline/PWA:** Web app supports offline queue for walk logs, feeding logs, volunteer submissions, inventory confirmations.

## Data Model

The spec defines 65+ tables across these domains: organizations/auth/RBAC, people/CRM, animals (with identifiers, breeds, relationships, photos), intake/outcome, kennel/facility, medical (visits, diagnoses, meds, vaccines, procedures), feeding, behavior/walks, tasks/boards/calendar, documents, forms (custom builder), contracts/e-sign, inventory, AI jobs, reporting. See `claude_pet.txt` section 2 for full schema.

## Current Status

**Milestone 1 (DONE - Backend):** Async SQLAlchemy + Supabase, Organization + Animal (basic), Alembic, JWT auth, RBAC (22 permissions, 7 role templates), audit logging.

**Milestone 2 (DONE - Frontend):** Next.js frontend with App Shell (Sidebar, Topbar, Mobile Nav), Dashboard with 6 widgets (drag-drop customizable), OrgSwitcher, RBAC navigation, i18n (cs/en), Zustand UI state, TanStack Query setup.

**Milestone 3 (IN PROGRESS - Backend):** Animal CRUD API with breeds, identifiers, extended fields, filters, pagination, audit logging. Migration and seeds complete. Some tests passing (20/39), but DB transaction issues in remaining tests need fixing.

**Next:** Build Animals frontend (list + detail + create/edit forms) to connect to the Animal CRUD API.

Docker-compose currently has PostgreSQL only (missing Redis, MinIO, API/worker/web services).

## Key Conventions

- All code and variable names in English
- UI text always through i18n (Czech + English)
- **Enum values are ALWAYS lowercase** (dog, cat, male, female, available, intake, etc.) - both in database and API
- **Python enums:** Use lowercase values with uppercase keys, e.g. `SUPABASE = "supabase"`. When passing to database, use `.value` property: `StorageProvider.SUPABASE.value` (not the enum member itself, which serializes as the key name, not the value)
- Contract templates use `{{placeholder}}` syntax (e.g. `{{person.first_name}}`, `{{animal.name}}`)
- Public animal listings are configurable: mode A (all in shelter) vs mode B (adoptable only)
- **TODO comments for future work:** When implementing a feature that will be completed in a future milestone, add a TODO comment with the milestone number (e.g. `// TODO: M3+ - Fetch real data from API`). This helps track implementation hooks and makes it easy to find what needs to be built next.

## Internationalization (i18n)

**Language Support:** Czech (cs) and English (en)

**User Language Preferences:**
- Each **User** can set their own preferred language (`locale` field on users table)
- Each **Organization** can set a default language for the organization (`default_locale` field on organizations table)
- Language preference priority: User preference > Organization default > System default (cs)
- All API responses should respect the user's language preference for error messages, notifications, and dynamic content
- Frontend UI text must be fully translatable (use i18n keys, no hardcoded strings)
- Database content (animal descriptions, notes, etc.) is stored in the language entered by the user
- System-generated content (email templates, reports, exports) should use the user's preferred language

**Implementation Notes:**
- Add `locale` column to `users` table (VARCHAR(5), default 'cs', values: 'cs', 'en')
- Add `default_locale` column to `organizations` table (VARCHAR(5), default 'cs')
- Backend error messages and validation should use i18n keys
- Frontend uses next-intl or similar for React Server Components
- **Database content i18n (breeds, diagnosis types, etc.):** Use separate translation tables. Example: `breeds` table has `id` and `code`, `breeds_i18n` table has `breed_id`, `locale`, and `name`. This allows system data to be translatable while keeping the schema clean.

---

## Frontend Specification (Web + PWA)

### 0. Goal
Build a modern, extremely user-friendly web frontend for shelter DMS (data-heavy app), responsive + PWA offline-first, ready for future mobile app. UX must be faster and friendlier than legacy systems (PetPoint), with focus on daily operations: today's medications, feeding, walks, kennels, tasks, alerts. All UI text exclusively through i18n (cs+en) from first commit.

### 1. Tech Stack (Required)
- **Core:** Next.js 14+ App Router, TypeScript
- **Styling:** TailwindCSS + shadcn/ui (Radix) + lucide-react
- **Data:** TanStack Query (server state), TanStack Table (datagrid)
- **Forms:** React Hook Form + Zod (validation), toast/sonner
- **UI State:** Zustand (sidebar, command palette state, dashboard edit mode)
- **i18n:** next-intl recommended (cs/en)
- **Offline:** Dexie (IndexedDB) + offline queue + service worker (PWA)
- **Drag & drop:** dnd-kit (boards + dashboard widget reorder; kennel map admin)
- **API client:** Generate typed client from OpenAPI into /packages/shared (orval / openapi-typescript)

### 2. UX Principles (Must be felt everywhere)
- **Minimal click path:** Quick actions, inline editing, sheet/drawer instead of multi-page
- **Global search + command palette (Cmd/Ctrl+K):** Search Animals/People/Tasks + quick actions
- **"Today first":** Dashboard as operational center, not management graphs
- **Mobile-first modes:** Large touch elements, sticky bottom action bar, "Shelter Walk Mode"
- **Status & severity language consistent:** Same colors, badges, icons across app
- **RBAC in UI:** What you can't do, you don't see / is disabled with tooltip; but backend enforcement is primary
- **AI is optional:** AI buttons only when org + permission; otherwise disabled

### 3. i18n (Required from start)
All UI strings through i18n (cs+en), including:
- Navigation, buttons, validations, empty states
- Enum labels (status, sex, priority, severity…)

**Key conventions:**
```
nav.dashboard
animals.status.available
actions.save
errors.required
```

- **Date/time:** Display in organization timezone (from org settings)
- **Units:** metric/imperial per org settings + format helpers

### 4. Information Architecture & Routes (App Router)

#### Auth
- `/login`
- `/select-org`

#### App (after login)
- `/dashboard`
- `/animals`, `/animals/new`, `/animals/[id]`
- `/intake/new` (wizard)
- `/kennels/map`, `/kennels/manage`
- `/inventory/walk` (nose count)
- `/medical/today`, `/medical/catalog`, `/medical/visits`
- `/feeding/today`, `/feeding/plans`
- `/tasks`, `/boards`, `/calendar`
- `/people`, `/people/[id]`
- `/adoptions/pipeline`, `/adoptions/new`
- `/fosters/network`
- `/documents`
- `/reports`
- `/alerts`
- `/settings/org`, `/settings/users-roles`, `/settings/public`, `/settings/ai…`

#### Public / volunteer
- `/public/[orgSlug]`, `/public/[orgSlug]/animals`, `/public/[orgSlug]/animals/[id]`
- `/sign/[token]` (public e-sign)
- `/volunteer/submit` (+ variants with QR prefill)

Each group has its own layout: auth layout (minimal), app shell layout (sidebar/topbar), public layout (SEO), volunteer layout (minimal + mobile-first).

### 5. App Shell Layout

#### Desktop
- **Left sidebar** (sections per RBAC)
- **Topbar:**
  - Org switcher
  - Global search (cmd+k)
  - Quick actions dropdown
  - Alerts bell (badge)
  - User menu: language, theme, density, logout

#### Mobile
- **Bottom nav** (Dashboard / Animals / Walk Mode / Alerts / Menu)
- **FAB** for quick actions
- **Sticky action bar** in animal detail (most common actions)

### 6. Data Patterns (TanStack Query)
- **Standard query keys** (org-aware): `['org', orgId, 'animals', filters]`
- **Mutations** with optimistic update for fast "mark given/fed"
- **Central error handling:**
  - 401 → redirect login
  - 403 → toast + inline "no access"
- **Skeleton loading** and empty states with clear CTA

### 7. PWA & Offline-first (MVP scope)

#### Offline read (cache)
- Kennel map + daily lists (medical today, feeding today, tasks today) available offline (last snapshot)

#### Offline write (queue)
Must work offline and sync later:
- Walk log
- Feeding log
- Volunteer submission (health/behavior report + photos)
- Inventory walk confirmations

#### Implementation
- **IndexedDB (Dexie):** offlineQueue + offlineFiles (photos) + snapshots
- **Sync manager:** When online, drain queue, UI shows queued/syncing/failed
- **Conflicts in MVP:** Failed item + retry + option to open draft for correction

### 8. AI-ready UI (feature-flagged)

AI entry points (only if AI enabled + permission ai.use):
- **Animal → Public profile:** "Generate bio (cs/en)", "Translate"
- **Animal → Overview:** "Summarize history"
- **Import wizard:** "Suggest CSV mapping"
- **Volunteer report:** Display triage result (severity + tips)

**UX for AI jobs:**
- Async job status (queued/running/done/failed)
- Preview + "Apply" / "Discard"
- Without AI: disabled button with tooltip

### 9. Dashboard (editable widgets)

**MVP:** Per-user customization:
- Show/hide widgets
- Reorder (drag/drop)
- Desktop grid sizing (optional)

Save layout ideally on server (user settings), fallback localStorage.

**Default widgets:**
- Today: Meds due (top priority)
- Today: Feeding due
- Today: Tasks due
- Alerts (unacknowledged)
- Occupancy by zone
- Quick actions
- Recently viewed animals

### 10. Key Screens — Specific UX Requirements

#### Animals list `/animals`
- **Desktop:** Datatable + filters (species/status/zone/kennel/age/sex/breed/tags)
- **Mobile:** Card list (not table)
- **Quick row actions:** Move, status change, log walk/feeding, print kennel card
- **Saved views** (MVP localStorage)

#### Animal detail `/animals/[id]`
- **Entity header:** Photo, name, public_code, status badge, location, alert badge
- **Quick actions (sheet):** Change status, move kennel, log walk, log feeding, add medical, upload photos, print PDF+QR
- **Tabs:** Overview, Timeline, Medical, Feeding, Behavior, Tasks, Documents, Public profile
- **Timeline:** Unified stream (intake, move, med, note, photo, outcome)

#### Intake wizard `/intake/new`
Steps:
1. Identify (search existing + microchip input)
2. Intake details
3. Assign kennel (available finder + map picker)
4. Auto-create tasks (checkbox templates)
5. Review + Save + print kennel card

#### Kennels map `/kennels/map` + Shelter Walk Mode
- **View map:** Kennel boxes, occupancy, alerts, quarantine
- **Admin edit mode:** Drag/resize map coords, edit zones/kennels
- **Walk Mode (mobile-first):** Walk through kennels, large buttons (fed/walked/cleaned), offline queue

#### Medical today `/medical/today`
- Daily medication list with extremely fast "Given/Missed/Refused"
- **Grouping toggle** (by zone / by time)
- **Offline queue supported**

#### Feeding today `/feeding/today`
- **Group by** zone/kennel
- **Batch mark fed**
- **Offline queue supported**

#### Volunteer submit `/volunteer/submit`
- **Minimal UI,** no login, mobile-first
- **QR prefill** animal/kennel
- **Forms:** Log walk, Health issue, Behavior issue, Add photos
- **After submit:** Clear instruction if critical (keyword rules)

#### Public listing `/public/[orgSlug]/animals`
- **SEO friendly,** fast
- **Mode A/B** (all vs adoptable)
- **Field visibility toggles** respected
- **Embed:** iframe route for widget

#### Sign `/sign/[token]`
- **Mobile-first e-sign flow:** Review → sign → submit

### 11. QA/Performance/A11y Minimum
- **Virtualization** of large lists (animals, medical today) if needed
- **Accessibility:** Focus states, keyboard nav, dialog focus trap
- **Playwright smoke e2e:** Login → create animal → intake → walk mode → volunteer submit

---

## UI Design System

### Color Palette

| Purpose | Color | Variable |
|---------|-------|----------|
| **Background (page)** | Warm gray | `--background` |
| **Cards/Panels** | White | `--card` |
| **Primary actions** | Purple-blue | `--primary` |
| **Filters** | Teal | `--color-filter` |
| **Navigation (prev/next)** | Blue | `--color-nav` |
| **Automated actions** | Orange | `--color-action` |
| **Destructive** | Red | `--destructive` |
| **Badges** | Various | Keep existing |

### Component Styling Rules

1. **Input fields** - White background (`bg-white`) to distinguish editable areas
2. **Select/Dropdown triggers** - White background
3. **Text info (labels, hints)** - No fill, gray text
4. **Badges** - Keep existing colors (status-based)
5. **Filters** - Use teal accent (`--color-filter`)
6. **Pagination/Navigation** - Use blue accent (`--color-nav`)
7. **Automated actions** - Use orange accent (`--color-action`)
8. **Delete actions** - Red (`--destructive`)

### CSS Variables (in `apps/web/app/globals.css`)

```css
:root {
  /* Input fields - white background */
  --input: oklch(1 0 0);
  
  /* Custom accent colors */
  --color-filter: oklch(0.52 0.18 172);    /* Teal - for filters */
  --color-nav: oklch(0.55 0.2 220);        /* Blue - for navigation */
  --color-action: oklch(0.58 0.18 30);    /* Orange - for automated actions */
}
```

### Keyboard Shortcuts

Default shortcuts (customizable per user):
- `Ctrl+K` - Global search
- `Ctrl+Shift+A` - Animals
- `Ctrl+Shift+K` - Kennels
- `Ctrl+Shift+T` - Tasks
- `Ctrl+Shift+I` - Inventory
- `Ctrl+Shift+F` - Feeding

Shortcuts are displayed:
- In sidebar as right-aligned text (when expanded)
- As tooltip on hover (when collapsed)

### Weather Widget

- **Provider**: Open-Meteo API (free, no API key)
- **Location**: Uses organization's lat/lng (falls back to Prague)
- **Display logic**:
  - Before 14:00 → Shows today's day weather
  - After 14:00 → Shows tonight's weather
- **Caching**: 30 minutes in localStorage (per organization)

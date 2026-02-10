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

Early scaffolding. Only the API has a basic skeleton with a `/health/db` endpoint. The docker-compose only has PostgreSQL (missing Redis, MinIO, API/worker/web services). No database models, migrations, auth, or business logic yet.

## Key Conventions

- All code and variable names in English
- UI text always through i18n (Czech + English)
- Contract templates use `{{placeholder}}` syntax (e.g. `{{person.first_name}}`, `{{animal.name}}`)
- Public animal listings are configurable: mode A (all in shelter) vs mode B (adoptable only)

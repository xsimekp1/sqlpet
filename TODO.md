# TODO - SQLpet / PawShelter Project

## High Priority EPICS

### EPIC 0: Infrastructure stabilization and reproducible build
- Establish Alembic as single source of migrations
- Fix CORS + cookies (JWT refresh in httpOnly) 
- Create seed demo org + data script
- Set up Docker compose (dev parity)
- Add basic monitoring (/health endpoint)

### EPIC 1: Canonical Intake/Outcome + Timeline Events
- Add DB tables: intakes, outcomes, animal_events
- Create intakeService.createIntakeFlow() domain service
- Implement timeline endpoint GET /animals/{id}/timeline
- Create Intake wizard frontend (/dashboard/intake/new)
- Add Timeline tab to animal detail

### EPIC 2: Single source of truth for moves (stays) + map DnD prep
- Fix animal_stays model as canonical stays table
- Create kennelService.moveAnimal() as single move path
- Implement move endpoints: POST /stays/move, POST /kennels/{id}/eject
- Create reusable Move dialog component
- Implement Map view MVP (/kennels/map)
- Add collision prevention for map DnD

### EPIC 3: Daily Ops - choose primary module (medical or walk)
- Option A: Implement /medical/today (medications focus)
- Option B: Implement /walk (caretakers/volunteers focus)

### EPIC 4: People/CRM + Staff Admin (Lidé)
**Cíl**: Mít jednu centrální sekci "Lidé", kde budu spravovat:
- staff uživatele (login do systému) + jejich role a oprávnění
- kontakty (adoptéři, dárci, nálezci, původní majitelé, veterináři, dobrovolníci, pěstouni…)
- základní historii interakcí (komunikace, dokumenty, návštěvy, adopce/foster)

**Klíčová designová rozhodnutí**:
- Oddělit "Users" vs "People" (users = mají login, people = kontakty)
- Jedna osoba může mít více typů (multi-role pomocí people_roles tabulky)
- Centralizovaná správa kontaktů s vazbami na zvířata

**Datový model (MVP)**:
- people (id, organization_id, first_name, last_name, email, phone, address, notes, gdpr_consent)
- people_roles (person_id, role enum/text: adopter, foster, volunteer, donor, owner, finder, vet_contact, staff_external)
- households (volitelné MVP pro adopce/foster)
- communications (MVP light: person_id, channel, subject, body, created_at, created_by)
- entity links (intakes.brought_by_person_id, outcomes.person_id, medical_visits.vet_id, walk_logs.walked_by_person_id)

**UI / Routes (MVP)**:
- /dashboard/people (List) - filtry: All, Volunteers, Fosters, Adopters, Donors, Vets, Owners/Finders, Staff
- /dashboard/people/new - minimální form (name, phone/email) + role selector
- /dashboard/people/[id] (Detail) - tabs: Overview, Related (animals), Communications, Documents
- /dashboard/settings/users-roles (Admin) - Users list, Invite user, Role editor

**Workflows (MVP)**:
1) Intake: "brought by" finder/owner with inline contact creation
2) Outcome: adoption/return to owner with person selection
3) Volunteer walk logs linked to person
4) Foster profile with capacity/preferences metadata
5) Deduplication check for email/phone
6) Quick actions from person detail (Create adoption, Create intake, Mark as volunteer)

**Acceptance Criteria**:
- Lze vytvořit person a přiřadit mu více rolí
- People list má filtry a search
- Person detail ukáže role + základní info + související intake/outcome vazby
- Admin sekce umožní spravovat staff účty odděleně od people kontaktů
- V intake/outcome formu jde vybrat/rychle vytvořit kontakt
- Deduplikační varování na stejný email/phone

---

### EPIC 5: Gradual module addition (Public, Reports, PWA)
- Implement Public listing + embed widget
- Create Reports (6 default reports + CSV export)
- PWA hardening (offline cache, robust sync)

## Current Status - Completed
✅ Fix enum types and merge migration heads
✅ Fix backend import and CORS issues for /kennels endpoint

## Upcoming features

### Intake / Animal Events (HIGH PRIORITY)
**Epic**: Create comprehensive animal intake flow with event-driven timeline

**Requirements**:
- Multi-step intake flow (/dashboard/intake)
- Animal identity creation + origin tracking + placement
- Event-driven timeline system (animal_events table)
- Kennel assignment integration

**Data Model Changes**:
- Add animal_events table with flexible payload
- Enum types: INTAKE, KENNEL_MOVE, LOCATION_CHANGE, MEDICAL, NOTE, STATUS_CHANGE, OUTCOME
- Subtypes for INTAKE: FOUND, BORN, SURRENDERED, TRANSFER_IN
- Track origin details per animal

**Backend Work**:
- POST /animal-events endpoint
- POST /intake orchestrator (transactional)
- Animal events service layer
- Update kennel moves to create events

**Frontend Work**:
- /dashboard/intake page with 3-step wizard
- Conditional forms per origin type
- Integration with kennel selection
- Redirect to animal detail after creation

**Acceptance Criteria**:
- Create animal + intake event in single transaction
- Origin-specific fields and validation
- Kennel assignment with timeline event
- Timeline display on animal detail

---

### Future features (BACKLOG)

#### Medical Module
- Medical events in timeline
- Visit tracking, diagnoses, medications
- Integration with animal_events

#### Adoption/Foster/Transfer
- Event types for location changes
- Application workflows
- Contract generation

#### Dashboard Enhancements
- Real-time kennel occupancy
- Today's medications/feeding
- Task management integration
- Alert system

#### Public Listings
- Configurable public animal pages
- SEO optimization
- Embed widget support

#### Mobile PWA
- Offline queue for field operations
- Walk mode for shelter operations
- Photo capture and sync

#### AI Features (Feature Flagged)
- Bio generation for animal profiles
- Behavior analysis from volunteer reports
- Adoption matching recommendations

---

## Technical Debt

#### Database Schema
- Add location_status to animals table
- Add intake_date cache field
- Review indexing strategy for events

#### API Performance
- Add pagination to list endpoints
- Implement caching for static data (breeds, zones)
- Database query optimization

#### Frontend
- Implement proper loading states
- Error boundary implementation
- Form validation improvements

#### Infrastructure
- Add Redis for caching
- Celery worker setup
- S3 storage integration

---

## Notes for Future Development

### Architecture Decisions
- Event-driven timeline provides flexibility for future features
- Separate operational tables (kennel_stays) from timeline events
- Multi-tenant isolation at organization level throughout

### Development Priorities
1. Fix current deployment issues (CORS, enum types)
2. Implement intake flow with events
3. Build animal detail timeline view
4. Add basic medical tracking
5. Implement task management

### Testing Strategy
- Unit tests for services and models
- Integration tests for API endpoints
- E2E tests for critical user flows (intake, kennel assignment)
- Performance testing for large datasets
# TODO list - SQLpet development

## Current issues (FIXING)
- ✅ Fix kennels model: enum types (_enum suffix removed)
- ✅ Fix UUID annotations: Mapped[str] → Mapped[uuid.UUID]
- ✅ Add kennels migration
- ✅ Add basic tasks endpoint (404 error)
- ❌ Railway deployment: wait for fix to apply, test /kennels and /tasks endpoints

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
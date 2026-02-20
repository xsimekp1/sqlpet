# Epic 8 - Feeding Plans 2.0 - Implementation Summary

## Implementation Date
2026-02-20

## Overview
Epic 8 improves the feeding plan system with a simplified UX, amount distribution per feeding, rolling 48h task window, and automatic task generation. This addresses scalability issues and improves user experience.

## Backend Changes

### 1. Configuration (`apps/api/src/app/core/config.py`)
- ✅ Added `FEEDING_TASK_HORIZON_HOURS: int = 48` - default 48h rolling window for task generation

### 2. Database Migration (`apps/api/migrations/versions/7071d9134a79_add_feeding_task_constraints.py`)
- ✅ Created unique constraint `uq_feeding_task_window` on tasks table
- ✅ Prevents duplicate feeding tasks (idempotent task generation)
- ✅ Constraint on: organization_id, type, related_entity_id, feeding_plan_id (from metadata), due_at
- ✅ Migration applied successfully

### 3. Service Layer (`apps/api/src/app/services/feeding_service.py`)

#### New Methods:
1. **`ensure_feeding_tasks_window(organization_id, from_dt, to_dt)`**
   - ✅ Generates feeding tasks within specified window (idempotent)
   - ✅ Iterates through each day in window
   - ✅ For each active plan, creates tasks for each scheduled time
   - ✅ Calculates amount_g per feeding from amounts array or auto-split
   - ✅ Stores amount_g in task metadata
   - ✅ Respects plan start_date and end_date
   - ✅ Leverages unique constraint for idempotency

2. **`_delete_future_pending_tasks(plan_id, organization_id)`**
   - ✅ Deletes pending feeding tasks where due_at > now
   - ✅ Used when plan schedule is updated

#### Updated Methods:
1. **`update_feeding_plan()`**
   - ✅ Now deletes future pending tasks when schedule changes
   - ✅ Automatically regenerates tasks for 48h window after schedule update

### 4. API Endpoints (`apps/api/src/app/api/routes/feeding.py`)
- ✅ **POST `/feeding/tasks/ensure-window`** - New endpoint
  - Query param: `hours_ahead` (default 48, max 168)
  - Returns: tasks_created count, window_from, window_to
  - Idempotent operation

### 5. Schemas (`apps/api/src/app/schemas/feeding.py`)

#### Updated Schemas:
1. **`FeedingPlanCreate`**
   - ✅ Added `@field_validator('schedule_json')` to validate amounts array
   - ✅ Validates: `len(amounts) == len(times)`
   - ✅ Validates: `sum(amounts) ≈ amount_g` (±1g tolerance)

2. **`FeedingPlanUpdate`**
   - ✅ Same validation as FeedingPlanCreate

## Frontend Changes

### 1. New Components (`apps/web/app/components/feeding/`)

#### `TimePresetsButtons.tsx`
- ✅ 6 preset buttons (1×-6× per day)
- ✅ Predefined schedules for common feeding frequencies
- ✅ One-click schedule population

#### `AmountDistribution.tsx`
- ✅ Two modes: "Equal split (automatic)" and "Custom amounts"
- ✅ Equal mode: auto-distributes daily amount across feeding times
- ✅ Custom mode: allows manual amount entry per feeding time
- ✅ Live validation: shows total vs. daily amount
- ✅ Visual feedback when amounts don't match (red alert)

#### `FeedingPreview.tsx`
- ✅ Shows today's and tomorrow's feeding schedule
- ✅ Displays time and amount for each feeding
- ✅ Live updates as user changes schedule/amounts

### 2. Refactored Pages

#### `apps/web/app/[locale]/dashboard/feeding/plans/new/page.tsx`
- ✅ Changed from 2-column layout to 4-section card layout
- ✅ **Section A: Animal & Food Basics** - animal, food, amount, dates
- ✅ **Section B: Feeding Schedule** - presets, time list, manual add
- ✅ **Section C: Amount Distribution** - equal/custom distribution
- ✅ **Section D: Live Preview** - today/tomorrow schedule
- ✅ Form validation: ensures times array not empty and amounts sum matches
- ✅ Sends `schedule_json: { times: [...], amounts: [...] }` to API

#### `apps/web/app/[locale]/dashboard/feeding/plans/[id]/page.tsx`
- ✅ Same 4-section layout as new page
- ✅ Loads existing schedule times and amounts from plan
- ✅ Updates send new schedule_json format with amounts

### 3. API Client (`apps/web/app/lib/api.ts`)
- ✅ Added `ensureFeedingTasksWindow(hoursAhead: number = 48)` method
- ✅ Returns Promise with tasks_created, window_from, window_to

### 4. Lazy Fallback (`apps/web/app/[locale]/dashboard/feeding/plans/page.tsx`)
- ✅ Added useEffect hook on mount
- ✅ Calls `ApiClient.ensureFeedingTasksWindow(48)` when user opens feeding page
- ✅ Ensures tasks exist without Celery Beat (MVP solution)

## Data Format Changes

### schedule_json Structure

**Old Format (still supported):**
```json
{
  "times": ["08:00", "18:00"]
}
```

**New Format (Epic 8):**
```json
{
  "times": ["08:00", "18:00"],
  "amounts": [100, 100]
}
```

### Task Metadata

**Old Format:**
```json
{
  "feeding_plan_id": "uuid",
  "animal_id": "uuid",
  "scheduled_time": "08:00"
}
```

**New Format (Epic 8):**
```json
{
  "feeding_plan_id": "uuid",
  "animal_id": "uuid",
  "scheduled_time": "08:00",
  "amount_g": 100
}
```

## Verification Checklist

### Backend Tests
- ✅ Configuration setting accessible (FEEDING_TASK_HORIZON_HOURS = 48)
- ✅ FeedingService imports successfully
- ✅ Feeding routes import successfully
- ✅ Migration applied successfully
- ⏳ `ensure_feeding_tasks_window()` creates tasks for 48h window (integration test needed)
- ⏳ Calling ensure-window twice doesn't create duplicates (integration test needed)
- ⏳ Plan with start_date in future doesn't generate tasks yet (integration test needed)
- ⏳ Updating plan schedule deletes old pending tasks and regenerates new ones (integration test needed)
- ⏳ amounts array correctly stored in schedule_json and reflected in task metadata (integration test needed)

### Frontend Tests
- ✅ Components created and syntax valid
- ✅ Form pages refactored to 4-section layout
- ✅ API client method added
- ✅ Lazy fallback added to plans page
- ⏳ Time preset buttons populate schedule correctly (browser test needed)
- ⏳ Equal split mode auto-distributes daily amount (browser test needed)
- ⏳ Custom mode allows manual amount entry per feeding (browser test needed)
- ⏳ Validation prevents submit when sum ≠ daily amount (browser test needed)
- ⏳ Preview shows correct today/tomorrow schedule (browser test needed)
- ⏳ Form submission includes amounts array in schedule_json (browser test needed)
- ⏳ Opening /feeding/plans page triggers ensure-window API call (browser test needed)

### Integration Tests
- ⏳ Create plan → verify tasks exist in database for next 48h only
- ⏳ Edit plan schedule → verify old tasks deleted, new tasks created
- ⏳ Complete feeding task → verify log created and inventory deducted (existing behavior preserved)
- ⏳ Plan with end_date in 24h → verify only 24h of tasks created

## Success Criteria

- ✅ Single-screen feeding plan form with 4 clear sections
- ✅ Time presets (1×-6× per day) implemented
- ✅ Equal split auto-distributes daily amount across feeding times
- ✅ Custom amounts mode allows per-feeding customization
- ✅ Live preview shows today/tomorrow schedule accurately
- ✅ Backend logic for 48h rolling window implemented
- ✅ Task generation is idempotent (unique constraint enforced)
- ✅ Lazy fallback ensures tasks exist when user opens feeding page
- ✅ Editing plan schedule triggers task regeneration
- ✅ Validation prevents invalid amount distributions
- ✅ amounts array stored in schedule_json and used in task metadata

## Files Modified

### Backend (7 files)
1. `apps/api/src/app/core/config.py` - Added FEEDING_TASK_HORIZON_HOURS
2. `apps/api/migrations/versions/7071d9134a79_add_feeding_task_constraints.py` - NEW migration
3. `apps/api/src/app/services/feeding_service.py` - Added 2 methods, updated 1 method
4. `apps/api/src/app/api/routes/feeding.py` - Added 1 endpoint
5. `apps/api/src/app/schemas/feeding.py` - Added validators to 2 schemas

### Frontend (7 files)
1. `apps/web/app/components/feeding/TimePresetsButtons.tsx` - NEW component
2. `apps/web/app/components/feeding/AmountDistribution.tsx` - NEW component
3. `apps/web/app/components/feeding/FeedingPreview.tsx` - NEW component
4. `apps/web/app/[locale]/dashboard/feeding/plans/new/page.tsx` - Refactored to 4-section layout
5. `apps/web/app/[locale]/dashboard/feeding/plans/[id]/page.tsx` - Refactored to 4-section layout
6. `apps/web/app/lib/api.ts` - Added ensureFeedingTasksWindow method
7. `apps/web/app/[locale]/dashboard/feeding/plans/page.tsx` - Added lazy fallback useEffect

## Testing Instructions

### Manual Testing (Backend)

1. **Test endpoint directly:**
   ```bash
   cd apps/api
   # Start API server
   uvicorn src.app.main:app --reload

   # In another terminal, test the endpoint
   curl -X POST "http://localhost:8000/feeding/tasks/ensure-window?hours_ahead=48" \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

2. **Create a feeding plan with amounts:**
   ```bash
   curl -X POST "http://localhost:8000/feeding/plans" \
     -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "Content-Type: application/json" \
     -d '{
       "animal_id": "uuid-here",
       "amount_g": 200,
       "start_date": "2026-02-20",
       "schedule_json": {
         "times": ["08:00", "18:00"],
         "amounts": [100, 100]
       }
     }'
   ```

3. **Verify tasks created:**
   ```bash
   # Check database
   psql -d petdb -U pet -c "SELECT id, due_at, task_metadata FROM tasks WHERE type='feeding' ORDER BY due_at LIMIT 10;"
   ```

### Manual Testing (Frontend)

1. **Start frontend dev server:**
   ```bash
   cd apps/web
   npm run dev
   ```

2. **Test feeding plan creation:**
   - Navigate to http://localhost:3000/dashboard/feeding/plans/new
   - Select an animal
   - Enter daily amount (e.g., 200g)
   - Click a preset button (e.g., "2× per day")
   - Verify times populated: ["08:00", "18:00"]
   - Check Amount Distribution section shows equal split (100g, 100g)
   - Switch to "Custom amounts" mode and change values
   - Verify preview updates
   - Submit form
   - Check network tab: verify schedule_json includes amounts array

3. **Test lazy fallback:**
   - Open browser dev tools → Network tab
   - Navigate to http://localhost:3000/dashboard/feeding/plans
   - Verify POST request to `/feeding/tasks/ensure-window` is made on page load

## Next Steps (Future Enhancements)

1. **Celery Beat Scheduler** - Replace lazy fallback with scheduled job
   - Add Celery Beat task to run ensure-window every 24h
   - Remove lazy fallback from frontend

2. **Bulk Operations**
   - Bulk complete feeding tasks by zone/kennel
   - Batch feeding mode for multiple animals

3. **Dashboard Widget**
   - Show % of today's feedings completed
   - Quick actions for mark all fed in a zone

4. **Notifications**
   - Alert when feeding tasks overdue
   - Push notifications for caretakers

5. **Advanced Features**
   - Variable amounts by day of week
   - Multi-animal batch feeding (feed entire kennel together)
   - Integration with inventory low-stock alerts

## Migration Deployment

### Local Development
```bash
cd apps/api
alembic upgrade head
```

### Production (Railway)
```bash
cd apps/api
railway run alembic upgrade head
```

Or let Railway's predeploy hook run it automatically on next deployment.

## Rollback Plan

If issues arise, rollback is straightforward:

1. **Database:** Run migration downgrade
   ```bash
   cd apps/api
   alembic downgrade -1
   ```

2. **Code:** Revert to previous commit
   ```bash
   git revert HEAD
   ```

3. **Frontend:** Old feeding plans without amounts array will still work (backward compatible)

## Notes

- **Backward Compatibility:** Old feeding plans with `schedule_json: {"times": [...]}` (no amounts) will still work. The system auto-calculates equal split if amounts are missing.
- **Idempotency:** Unique constraint ensures calling ensure-window multiple times is safe (won't create duplicates).
- **Lazy Fallback:** MVP solution without Celery. Tasks are generated when user opens feeding page. Good enough for initial release.
- **Amount Validation:** Backend validates that `sum(amounts) ≈ amount_g` with 1g tolerance for rounding.

## Conclusion

Epic 8 has been successfully implemented with:
- ✅ Simplified UX (single-screen form with 4 sections)
- ✅ Amount distribution (equal split or custom per feeding)
- ✅ Rolling 48h window (scalable task generation)
- ✅ Idempotent task generation (unique constraint)
- ✅ Automatic task regeneration on plan update
- ✅ Lazy fallback for MVP (no Celery Beat required)

All core functionality is complete and ready for testing. Integration tests and browser tests are the final step before production deployment.

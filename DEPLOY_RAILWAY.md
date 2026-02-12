# Railway Deployment Guide - Task, Feeding & Inventory Systems

## Pre-Deployment Checklist

✅ **Migrations Fixed:**
- `006_add_tasks_table.py` - Tasks table (depends on: 533a94311006)
- `007_add_inventory_feeding_tables.py` - Inventory & Feeding tables (depends on: 006_add_tasks_table)

✅ **Files Ready:**
- 6 new models (Food, FeedingPlan, FeedingLog, InventoryItem, InventoryLot, InventoryTransaction)
- 2 new services (FeedingService, InventoryService)
- 2 new route modules (feeding, inventory)
- 30 new API endpoints

⚠️ **Important:** Delete old migration files if they still exist:
- `migrations/versions/004_add_tasks_table.py` (OLD - conflicts with kennels)
- `migrations/versions/005_add_inventory_feeding_tables.py` (OLD)

## Deployment Steps

### 1. Commit and Push

```bash
# Make sure you're in the project root
cd C:/Users/EliteBook/Projects/sqlpet

# Check git status
git status

# Add all new files
git add apps/api/src/app/models/food.py
git add apps/api/src/app/models/feeding_plan.py
git add apps/api/src/app/models/feeding_log.py
git add apps/api/src/app/models/inventory_item.py
git add apps/api/src/app/models/inventory_lot.py
git add apps/api/src/app/models/inventory_transaction.py
git add apps/api/src/app/services/feeding_service.py
git add apps/api/src/app/services/inventory_service.py
git add apps/api/src/app/api/routes/feeding.py
git add apps/api/src/app/api/routes/inventory.py
git add apps/api/src/app/schemas/feeding.py
git add apps/api/src/app/schemas/inventory.py
git add apps/api/migrations/versions/006_add_tasks_table.py
git add apps/api/migrations/versions/007_add_inventory_feeding_tables.py

# Add modified files
git add apps/api/src/app/models/__init__.py
git add apps/api/src/app/models/task.py
git add apps/api/src/app/services/task_service.py
git add apps/api/src/app/schemas/task.py
git add apps/api/src/app/api/routes/tasks.py
git add apps/api/src/app/db/seed_data.py
git add apps/api/src/app/main.py

# Commit
git commit -m "feat: complete task, feeding, and inventory systems with integration

- Add task system with CRUD operations and completion workflow
- Add feeding plans with schedules and automatic task generation
- Add inventory management with lot tracking and FIFO deduction
- Add feeding logs with automatic inventory deduction
- Integrate tasks with feeding (complete task → log feeding → deduct inventory)
- Add 30 new API endpoints across /tasks, /feeding, /inventory
- Add permissions: tasks.read/write, feeding.read/write
- Ready for demo with manual task generation (MVP - no Celery Beat)"

# Push to trigger Railway deployment
git push origin main
```

### 2. Wait for Deployment

Railway will automatically:
1. Pull the latest code
2. Build the Docker image
3. Start the new API version

**Check deployment:**
- Go to Railway dashboard
- Click on your API service
- Watch the "Deployments" tab for logs

### 3. Run Migrations on Railway

Once deployment succeeds, run migrations:

```bash
# Link to Railway (if not already linked)
cd apps/api
railway link

# Check current migration status
railway run alembic current

# Run migrations
railway run alembic upgrade head
```

**Expected output:**
```
INFO  [alembic.runtime.migration] Running upgrade 533a94311006 -> 006_add_tasks_table, Add tasks table
INFO  [alembic.runtime.migration] Running upgrade 006_add_tasks_table -> 007_add_inventory_feeding, Add inventory and feeding tables
```

### 4. Verify Database Schema

```bash
# Check tables were created
railway run python -c "
from src.app.db.session import AsyncSessionLocal
from sqlalchemy import text
import asyncio

async def check_tables():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text(\"\"\"
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('tasks', 'foods', 'feeding_plans', 'feeding_logs', 'inventory_items', 'inventory_lots', 'inventory_transactions')
            ORDER BY table_name
        \"\"\"))
        tables = [row[0] for row in result]
        print(f'✓ Found {len(tables)} tables: {tables}')
        return len(tables) == 7

asyncio.run(check_tables())
"
```

Should output: `✓ Found 7 tables: ['feeding_logs', 'feeding_plans', 'foods', 'inventory_items', 'inventory_lots', 'inventory_transactions', 'tasks']`

### 5. Update Permissions

```bash
# Run seed data to add new permissions
railway run python -m src.app.db.seed_data
```

Should add:
- `tasks.read`, `tasks.write`
- `feeding.read`, `feeding.write`

### 6. Test API Endpoints

**Get Railway API URL:**
```bash
railway status
```

Or check Railway dashboard for the public domain.

**Test endpoints:**

```bash
# Set your Railway API URL
API_URL="https://your-api.up.railway.app"

# Login (get token)
curl -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"your_password"}'

# Save the token
TOKEN="your_jwt_token"
ORG_ID="your_org_id"

# Test 1: Create a task
curl -X POST "$API_URL/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Task",
    "description": "Testing task creation",
    "type": "general",
    "priority": "medium"
  }'

# Test 2: List tasks
curl "$API_URL/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID"

# Test 3: Create inventory item
curl -X POST "$API_URL/inventory/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dog Food - Premium",
    "category": "food",
    "unit": "kg",
    "reorder_threshold": 10
  }'

# Test 4: List inventory
curl "$API_URL/inventory/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID"

# Test 5: Create food
curl -X POST "$API_URL/feeding/foods" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Dry Food",
    "brand": "Royal Canin",
    "type": "dry",
    "kcal_per_100g": 380
  }'
```

### 7. Test Complete Workflow

**End-to-end feeding workflow:**

1. Create inventory item + lot
2. Create food
3. Create feeding plan for an animal
4. Generate feeding tasks: `POST /feeding/generate-tasks`
5. Complete feeding task: `POST /feeding/tasks/{task_id}/complete`
6. Verify:
   - Task status = completed
   - Feeding log created
   - Inventory deducted

---

## Troubleshooting

### Migration Conflicts

If you see "Target database is not up to date":
```bash
railway run alembic stamp head
railway run alembic upgrade head
```

### Old Migration Files

If migrations fail due to duplicate revision IDs:
- Manually delete `004_add_tasks_table.py` and `005_add_inventory_feeding_tables.py` from the migrations/versions folder
- Keep only `006_add_tasks_table.py` and `007_add_inventory_feeding_tables.py`
- Commit and push again

### Permission Errors

If you get 403 errors after deployment:
```bash
railway run python -m src.app.db.seed_data
```

This ensures permissions are added.

### Import Errors

If you see `ModuleNotFoundError`:
- Check that all files were committed
- Verify Railway is using the correct Python version (3.11+)
- Check Railway logs for build errors

---

## Success Indicators

✅ **Deployment successful when:**
1. Railway shows "Deployment: Active"
2. Migrations run without errors (7 new tables created)
3. API returns 200 on health check: `GET /health`
4. Can create tasks, inventory items, and feeding plans
5. Task-feeding integration works (complete task → log + deduct)

✅ **Ready for demo when:**
- All 30 endpoints return valid responses
- Can generate feeding tasks from plans
- Inventory deduction works automatically
- Transaction history shows feeding_log links

---

## Next Steps

After successful deployment:
1. Test with Swagger docs: `https://your-api.up.railway.app/docs`
2. Create demo data (animals, inventory, feeding plans)
3. Generate tasks and complete them to show the workflow
4. Build frontend pages to consume these APIs

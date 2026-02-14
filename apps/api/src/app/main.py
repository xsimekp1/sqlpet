from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.app.api.routes.health import router as health_router
from src.app.api.routes.auth import router as auth_router
from src.app.api.routes.animals import router as animals_router, breed_router
from src.app.api.routes.kennels import router as kennels_router
from src.app.api.routes.stays import router as stays_router
from src.app.api.routes.tasks import router as tasks_router
from src.app.api.routes.feeding import router as feeding_router
from src.app.api.routes.inventory import router as inventory_router
from src.app.api.routes.tags import router as tags_router

# Re-enable files router after fixing IndentationError
from src.app.api.routes.files import router as files_router
from src.app.api.routes.timezones import router as timezones_router
from src.app.api.routes.admin import router as admin_router
from src.app.api.routes.contacts import router as contacts_router

# Files router is now working properly after fixing import issues

from src.app.db.session import async_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed permissions and role templates on startup
    try:
        from src.app.db.seed_data import (
            seed_permissions,
            seed_role_templates,
            ROLE_TEMPLATES,
        )
        from src.app.db.session import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            perm_map = await seed_permissions(db)
            await seed_role_templates(db, perm_map)
            await db.commit()
        print(
            f"✓ Seeded {len(perm_map)} permissions and {len(ROLE_TEMPLATES)} role templates"
        )
    except Exception as e:
        print(f"✗ Failed to seed data: {e}")

    yield
    await async_engine.dispose()


app = FastAPI(title="SQLpet API", lifespan=lifespan)

# CORS configuration
# For production, explicitly list allowed origins for security
ALLOWED_ORIGINS = [
    "http://localhost:3000",  # Local dev
    "http://localhost:5173",  # Vite dev
    "https://web-theta-peach-77.vercel.app",
    "https://sqlpet.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",  # All Vercel preview deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(animals_router)
app.include_router(breed_router)
app.include_router(kennels_router)
app.include_router(stays_router)
app.include_router(tasks_router)
app.include_router(feeding_router)
app.include_router(inventory_router)
app.include_router(tags_router)
app.include_router(files_router)

app.include_router(timezones_router)
app.include_router(admin_router)
app.include_router(contacts_router)

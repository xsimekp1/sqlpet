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
from src.app.api.routes.files import router as files_router
from src.app.api.routes.timezones import router as timezones_router

    print("✅ Files router imported successfully")
except Exception as e:
    print(f"❌ Failed to import files router: {e}")
files_router = None

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
    "https://web-theta-peach-77.vercel.app",  # Vercel production
    "https://sqlpet.vercel.app",  # Vercel alternative domain
    "https://*.vercel.app",  # Vercel preview deployments
]

# In development/testing, allow all origins
# TODO: Remove wildcard in production and use only ALLOWED_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # Use explicit origins for production
    allow_credentials=True,
    allow_methods=["*"],
    # Explicitly allow custom headers
    allow_headers=[
        "authorization",
        "content-type",
        "x-organization-id",
        "accept",
        "accept-language",
        "accept-encoding",
        "origin",
    ],
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
if files_router:
    app.include_router(files_router)
    print("✅ Files router included")
    print(f"🔍 Files router type: {type(files_router)}")
else:
    print("❌ Files router not included due to import errors")

if timezones_router:
    app.include_router(timezones_router)
    print("✅ Timezones router included")
    print(f"🔍 Timezones router type: {type(timezones_router)}")
else:
    print("❌ Timezones router not included due to import errors")

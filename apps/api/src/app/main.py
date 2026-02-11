from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from alembic.config import Config
from alembic import command

from src.app.api.routes.health import router as health_router
from src.app.api.routes.auth import router as auth_router
from src.app.api.routes.animals import router as animals_router, breed_router
from src.app.api.routes.kennels import router as kennels_router
from src.app.api.routes.stays import router as stays_router
from src.app.api.routes.tasks import router as tasks_router
from src.app.db.session import async_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run database migrations on startup
    try:
        alembic_cfg = Config("alembic.ini")
        command.upgrade(alembic_cfg, "head")
        print("Database migrations completed successfully")
    except Exception as e:
        print(f"Failed to run migrations: {e}")
        # Don't fail startup, but log the error

    # Seed permissions and role templates (idempotent)
    try:
        from src.app.db.seed_data import seed_permissions, seed_role_templates, ROLE_TEMPLATES
        from src.app.db.session import AsyncSessionLocal
        from src.app.models.role import Role
        from src.app.models.role_permission import RolePermission
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            print("Seeding permissions and role templates...")
            perm_map = await seed_permissions(db)
            await seed_role_templates(db, perm_map)
            print(f"Seeded {len(perm_map)} permissions and {len(ROLE_TEMPLATES)} role templates")

            # Fix existing organization roles by copying permissions from templates
            print("Fixing existing organization roles...")
            result = await db.execute(select(Role).where(Role.is_template.is_(True)))
            templates = {r.name: r for r in result.scalars().all()}

            result = await db.execute(select(Role).where(Role.is_template.is_(False)))
            org_roles = result.scalars().all()

            for org_role in org_roles:
                template = templates.get(org_role.name)
                if not template:
                    continue

                # Get template permissions
                result = await db.execute(
                    select(RolePermission).where(RolePermission.role_id == template.id)
                )
                template_perms = result.scalars().all()

                # Get existing permissions
                result = await db.execute(
                    select(RolePermission).where(RolePermission.role_id == org_role.id)
                )
                existing_perms = {rp.permission_id for rp in result.scalars().all()}

                # Copy missing permissions
                added_count = 0
                for template_perm in template_perms:
                    if template_perm.permission_id not in existing_perms:
                        db.add(RolePermission(
                            role_id=org_role.id,
                            permission_id=template_perm.permission_id,
                            allowed=template_perm.allowed
                        ))
                        added_count += 1

                if added_count > 0:
                    print(f"  Fixed role '{org_role.name}': added {added_count} permissions")

            await db.commit()
            print("Startup seed and fix completed successfully")
    except Exception as e:
        print(f"Failed to seed data: {e}")
        import traceback
        traceback.print_exc()
        # Don't fail startup, but log the error

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

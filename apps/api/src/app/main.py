import os
import re
import time
import uuid
from contextlib import asynccontextmanager
from contextvars import copy_context

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
from src.app.api.routes.intake import router as intake_router
from src.app.api.routes.hotel_reservations import router as hotel_reservations_router
from src.app.api.routes.search import router as search_router
from src.app.api.routes.shortcuts import router as shortcuts_router
from src.app.api.routes.incidents import router as incidents_router
from src.app.api.routes.organization import router as organization_router
from src.app.api.routes.finding import router as finding_router
from src.app.api.routes.vaccinations import router as vaccinations_router
from src.app.api.routes.walks import router as walks_router
from src.app.api.routes.chat import router as chat_router
from src.app.api.routes.calendar import router as calendar_router
from src.app.api.routes.animals_stats import router as animals_stats_router

# Files router is now working properly after fixing import issues

from src.app.db.session import async_engine
from src.app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run database migrations on startup
    try:
        from alembic.config import Config
        from alembic import command as alembic_command
        import asyncio

        alembic_cfg = Config("alembic.ini")

        # Stamp DB to current head (fix stale migration references)
        try:
            await asyncio.to_thread(
                alembic_command.stamp, alembic_cfg, "add_kennel_map_layout"
            )
            print("✓ Database stamped to current revision")
        except Exception as stamp_err:
            print(f"Stamp warning: {stamp_err}")

        await asyncio.to_thread(alembic_command.upgrade, alembic_cfg, "head")
        print("✓ Database migrations applied")
    except Exception as e:
        print(f"✗ Migration failed: {e}")

    # Sync missing tables (fallback if migrations fail)
    try:
        import subprocess
        import sys

        script_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "scripts", "sync_tables.py"
        )
        if os.path.exists(script_path):
            result = subprocess.run(
                [sys.executable, script_path],
                capture_output=True,
                text=True,
                env={
                    **os.environ,
                    "PYTHONPATH": os.path.join(os.path.dirname(__file__), ".."),
                },
            )
            if result.returncode == 0:
                print("✓ Database tables synced")
            else:
                print(f"✗ Table sync failed: {result.stderr}")
    except Exception as e:
        print(f"✗ Table sync error: {e}")

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

    # Ensure Supabase storage buckets exist
    try:
        from src.app.services.supabase_storage_service import supabase_storage_service

        supabase_storage_service.ensure_buckets_exist()
        print("✓ Storage buckets ensured")
    except Exception as e:
        print(f"✗ Failed to ensure buckets: {e}")

    # Setup performance monitoring if enabled
    if settings.PERF_ENABLED:
        print("✓ Performance monitoring enabled")
        if async_engine.sync_engine:
            from src.app.perf.sql import setup_sql_listeners

            setup_sql_listeners(async_engine.sync_engine)

    yield
    await async_engine.dispose()


app = FastAPI(title="SQLpet API", lifespan=lifespan)

# CORS configuration
# For production, explicitly list allowed origins for security
_extra = os.getenv("CORS_ORIGINS", "")
EXTRA_ORIGINS = [o.strip() for o in _extra.split(",") if o.strip()]

ALLOWED_ORIGINS = [
    "http://localhost:3000",  # Local dev
    "http://localhost:5173",  # Vite dev
    "https://web-theta-peach-77.vercel.app",
    "https://sqlpet.vercel.app",
    *EXTRA_ORIGINS,
]


@app.exception_handler(HTTPException)
async def cors_aware_http_exception_handler(request: Request, exc: HTTPException):
    origin = request.headers.get("origin", "")
    headers = {}
    if origin and (
        origin in ALLOWED_ORIGINS or re.match(r"https://.*\.vercel\.app", origin)
    ):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers,
    )


@app.exception_handler(Exception)
async def cors_aware_general_exception_handler(request: Request, exc: Exception):
    import traceback

    print(f"UNHANDLED EXCEPTION [{request.method} {request.url.path}]: {exc}")
    print(traceback.format_exc())
    origin = request.headers.get("origin", "")
    headers = {}
    if origin and (
        origin in ALLOWED_ORIGINS or re.match(r"https://.*\.vercel\.app", origin)
    ):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500, content={"detail": "Internal server error"}, headers=headers
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",  # All Vercel preview deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Add performance middleware if enabled
if settings.PERF_ENABLED:
    from src.app.perf.middleware import PerfMiddleware

    app.add_middleware(PerfMiddleware)


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    from src.app.db.session import _request_query_data

    request_id = str(uuid.uuid4())[:8]
    start_time = time.perf_counter()

    ctx = copy_context()
    data = {"queries": [], "total_db_time": 0.0, "query_count": 0}
    token = _request_query_data.set(data)

    try:
        response = await call_next(request)
    finally:
        _request_query_data.reset(token)

    total_time = time.perf_counter() - start_time
    db_time = data["total_db_time"]
    query_count = data["query_count"]

    sorted_queries = sorted(data["queries"], key=lambda x: x["duration"], reverse=True)
    slow_queries = []
    for q in sorted_queries[:3]:
        sql = q["statement"].replace("\n", " ").strip()
        if len(sql) > 150:
            sql = sql[:150] + "..."
        slow_queries.append(f"{sql} ({q['duration'] * 1000:.1f}ms)")

    params = dict(request.query_params)
    params.pop("authorization", None)
    params.pop("Authorization", None)
    safe_params = {
        k: v
        for k, v in params.items()
        if k.lower() not in ("token", "secret", "password")
    }

    log_parts = [
        f"request_id={request_id}",
        f"method={request.method}",
        f"path={request.url.path}",
        f"status={response.status_code}",
        f"total_ms={total_time * 1000:.1f}",
        f"db_ms={db_time * 1000:.1f}",
        f"queries={query_count}",
    ]
    if safe_params:
        log_parts.append(f"params={safe_params}")
    if slow_queries:
        log_parts.append(f"slow_queries={' | '.join(slow_queries)}")

    print(" | ".join(log_parts))

    response.headers["X-Request-ID"] = request_id
    return response


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
app.include_router(intake_router)
app.include_router(hotel_reservations_router)
app.include_router(search_router)
app.include_router(shortcuts_router)
app.include_router(incidents_router)
app.include_router(organization_router)
app.include_router(finding_router)
app.include_router(vaccinations_router)
app.include_router(walks_router)
app.include_router(chat_router)
app.include_router(calendar_router)
app.include_router(animals_stats_router)

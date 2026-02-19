import time
import uuid
from contextvars import ContextVar
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import create_engine, event, pool

from src.app.core.config import settings

_request_query_data: ContextVar[dict[str, Any]] = ContextVar(
    "request_query_data",
    default={"queries": [], "total_db_time": 0.0, "query_count": 0},
)

# Async engine (for FastAPI runtime)
# Use NullPool for Supabase PgBouncer which has connection limits
async_engine = create_async_engine(
    settings.DATABASE_URL_ASYNC,
    echo=(settings.ENV == "dev"),
    pool_pre_ping=True,
    poolclass=pool.NullPool,  # NullPool for Supabase PgBouncer compatibility
    pool_timeout=30,
    connect_args={
        "statement_cache_size": 0,
        "ssl": "require",
        "timeout": 30,
    },
)


def _setup_engine_events(engine: Any) -> None:
    @event.listens_for(engine, "before_cursor_execute")
    def before_cursor_execute(
        conn, cursor, statement, parameters, context, executemany
    ):
        conn.info.setdefault("query_start_time", []).append(time.perf_counter())
        conn.info.setdefault("query_statement", []).append(statement)

    @event.listens_for(engine, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        total = time.perf_counter() - conn.info["query_start_time"].pop()
        data = _request_query_data.get()
        data["queries"].append({"statement": statement[:200], "duration": total})
        data["total_db_time"] += total
        data["query_count"] += 1


if async_engine.sync_engine:
    _setup_engine_events(async_engine.sync_engine)

# Sync engine (for Alembic migrations)
sync_engine = create_engine(
    settings.DATABASE_URL_SYNC,
    echo=(settings.ENV == "dev"),
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

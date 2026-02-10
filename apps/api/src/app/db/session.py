from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import create_engine

from src.app.core.config import settings

# Async engine (for FastAPI runtime)
# statement_cache_size=0 is required for Supabase PgBouncer in transaction mode
async_engine = create_async_engine(
    settings.DATABASE_URL_ASYNC,
    echo=(settings.ENV == "dev"),
    pool_pre_ping=True,
    connect_args={
        "statement_cache_size": 0,
        "ssl": "require",
    },
)

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

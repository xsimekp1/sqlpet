from typing import AsyncGenerator

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import OperationalError, TimeoutError as SATimeoutError

from src.app.db.session import AsyncSessionLocal


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    try:
        async with AsyncSessionLocal() as session:
            yield session
    except (OperationalError, SATimeoutError, Exception) as e:
        err_str = str(e)
        # Supabase circuit breaker / asyncpg connection failures → 503
        if any(kw in err_str for kw in (
            "Circuit breaker",
            "Failed to retrieve database credentials",
            "connection was closed",
            "ConnectionDoesNotExistError",
            "could not connect",
            "Connection refused",
        )):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database temporarily unavailable. Please try again shortly.",
            )
        raise

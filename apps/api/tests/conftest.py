import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.db.session import AsyncSessionLocal, async_engine


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture()
async def db_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture(scope="session", autouse=True)
async def dispose_engine():
    yield
    await async_engine.dispose()

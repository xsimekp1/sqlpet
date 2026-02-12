import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Use the same DATABASE_URL from the environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://pet:pet@localhost:5432/petdb")

async def clear_tables():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        # Delete all animals data
        await conn.execute(text("DELETE FROM animal_identifiers"))
        await conn.execute(text("DELETE FROM animal_breeds"))
        await conn.execute(text("DELETE FROM animals"))
        print("Cleared all animal tables")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(clear_tables())

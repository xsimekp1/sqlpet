import asyncio
from sqlalchemy import text
from src.app.db.session import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("DELETE FROM animals WHERE public_code='A-2026-000001'"))
        await db.commit()
        print(f'Deleted {result.rowcount} animals')

asyncio.run(main())

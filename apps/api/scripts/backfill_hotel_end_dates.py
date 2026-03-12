import asyncio
from sqlalchemy import text


async def backfill():
    from src.app.db.session import async_engine

    async with async_engine.begin() as conn:
        result = await conn.execute(
            text("""
            UPDATE intakes i
            SET planned_end_date = r.end_date
            FROM hotel_reservations r
            WHERE i.reason = 'hotel'
            AND i.planned_end_date IS NULL
            AND i.kennel_id = r.kennel_id
            AND i.organization_id = r.organization_id
            AND r.end_date IS NOT NULL
            AND r.status IN ('checked_in', 'checked_out', 'completed')
        """)
        )
        print(f"Updated {result.rowcount} rows")


if __name__ == "__main__":
    asyncio.run(backfill())

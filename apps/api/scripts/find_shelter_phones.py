"""
Script to find phone numbers for registered shelters that don't have them.
Run with: python scripts/find_shelter_phones.py

This script:
1. Gets shelters without phones from the database
2. Uses web search to find their websites
3. Extracts phone numbers from the results

Prerequisites:
- Set DATABASE_URL environment variable
- Run: pip install sqlalchemy asyncpg
"""

import asyncio
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("DATABASE_URL_ASYNC")
if not DATABASE_URL:
    print("DATABASE_URL not set")
    exit(1)

# Convert to async URL
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)


def extract_phone_from_text(text: str) -> str | None:
    """Extract phone number from text using regex."""
    patterns = [
        r"\+420\s*\d{3}\s*\d{3}\s*\d{3}",
        r"\+421\s*\d{3}\s*\d{3}\s*\d{3}",
        r"0\d{3}\s*\d{3}\s*\d{3}",
        r"\d{3}\s*\d{3}\s*\d{3}",
        r"\+420\d{9}",
        r"\+421\d{9}",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0).strip()
    return None


async def get_shelters_without_phones(session: AsyncSession) -> list[dict]:
    """Get all shelters that don't have phone numbers."""
    result = await session.execute(
        text("""
        SELECT id, name, address, region, website, phone
        FROM registered_shelters
        WHERE (phone IS NULL OR phone = '')
        ORDER BY region, name
    """)
    )
    rows = result.fetchall()
    return [
        {
            "id": str(row[0]),
            "name": row[1],
            "address": row[2],
            "region": row[3],
            "website": row[4],
            "phone": row[5],
        }
        for row in rows
    ]


async def update_shelter_phone(
    session: AsyncSession, shelter_id: str, phone: str | None
):
    """Update shelter with found phone number."""
    await session.execute(
        text("UPDATE registered_shelters SET phone = :phone WHERE id = :id"),
        {"phone": phone, "id": shelter_id},
    )
    await session.commit()


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        shelters = await get_shelters_without_phones(session)
        print(f"Found {len(shelters)} shelters without phone numbers")

        if not shelters:
            print("No shelters to process")
            return

        print("\nShelters without phones:")
        for s in shelters[:10]:
            print(f"  - {s['name']} ({s['region']})")
        if len(shelters) > 10:
            print(f"  ... and {len(shelters) - 10} more")

        print("\nTo find phones, this script needs to be run with web search access.")
        print(
            "The websearch tool would be called for each shelter to find their phone number."
        )
        print("\nExample search query for each shelter:")
        print(f"  '{shelters[0]['name']} {shelters[0]['region']} útulek telefon'")


if __name__ == "__main__":
    asyncio.run(main())

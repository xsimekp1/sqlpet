#!/usr/bin/env python3
"""
Add mer_kcal_per_day column to animals table and backfill data.
Run: python scripts/backfill_animal_mer.py
"""

import os
import sys
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

script_dir = os.path.dirname(os.path.abspath(__file__))
api_dir = os.path.dirname(script_dir)
sys.path.insert(0, api_dir)
sys.path.insert(0, os.path.join(api_dir, "src"))

from src.app.core.config import settings


async def main():
    print("=== Adding mer_kcal_per_day column and backfilling ===")

    DATABASE_URL = settings.DATABASE_URL_ASYNC
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL_ASYNC not set")
        sys.exit(1)

    engine = create_async_engine(DATABASE_URL)

    # Step 1: Check and add column (separate connection)
    async with engine.begin() as conn:
        # Check if column exists
        result = await conn.execute(
            text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'animals' 
            AND column_name = 'mer_kcal_per_day'
            AND table_schema = 'public'
        """)
        )
        exists = result.fetchone()

        if not exists:
            print("Adding column: mer_kcal_per_day")
            await conn.execute(
                text("ALTER TABLE animals ADD COLUMN mer_kcal_per_day INTEGER")
            )
            print("✓ Column added")
        else:
            print("✓ Column already exists")

    # Step 2: Calculate and update MER values (separate connection)
    async with engine.begin() as conn:
        # Get all animals with weight
        print("\nCalculating MER for all animals...")

        result = await conn.execute(
            text("""
            SELECT id, weight_current_kg, species, altered_status
            FROM animals 
            WHERE weight_current_kg IS NOT NULL 
            AND deleted_at IS NULL
        """)
        )
        animals = result.fetchall()

        updated = 0
        for animal in animals:
            animal_id, weight, species, altered = animal

            if not weight or weight <= 0:
                continue

            # Calculate RER = 70 × weight^0.75
            rer = 70 * (float(weight) ** 0.75)

            # Activity factor
            if species == "cat":
                activity_factor = 1.2
            elif altered == "intact":
                activity_factor = 1.8  # intact dog
            else:
                activity_factor = 1.4  # neutered

            mer = int(rer * activity_factor)

            # Update
            await conn.execute(
                text("UPDATE animals SET mer_kcal_per_day = :mer WHERE id = :id"),
                {"mer": mer, "id": animal_id},
            )
            updated += 1

        print(f"✓ Updated {updated} animals with MER values")

        # Show sample
        result = await conn.execute(
            text("""
            SELECT name, weight_current_kg, mer_kcal_per_day, species, altered_status
            FROM animals 
            WHERE mer_kcal_per_day IS NOT NULL
            LIMIT 5
        """)
        )
        print("\nSample data:")
        for row in result.fetchall():
            print(f"  {row[0]}: {row[1]}kg -> {row[2]} kcal/day")

    print("\n=== Done ===")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

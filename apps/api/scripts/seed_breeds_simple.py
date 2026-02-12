# -*- coding: utf-8 -*-
"""
Simple script to seed breeds directly with SQL (avoids ORM relationship issues)
"""

import asyncio
import os
import sys
from pathlib import Path
import uuid
import asyncpg

# Add the src directory to Python path to import settings
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.app.core.config import settings


# Czech translations with weight ranges (kg)
BREED_DATA = {
    "beagle": {
        "en": "Beagle",
        "cs": "Bigl",
        "weight_male_min": 10,
        "weight_male_max": 11,
        "weight_female_min": 9,
        "weight_female_max": 10
    },
    "chihuahua": {
        "en": "Chihuahua",
        "cs": "Civava",
        "weight_male_min": 1.5,
        "weight_male_max": 3,
        "weight_female_min": 1.5,
        "weight_female_max": 3
    },
    "dachshund": {
        "en": "Dachshund",
        "cs": "Jezevcik",
        "weight_male_min": 7,
        "weight_male_max": 15,
        "weight_female_min": 7,
        "weight_female_max": 15
    },
    "german-shepherd": {
        "en": "German Shepherd",
        "cs": "Nemecky ovcak",
        "weight_male_min": 30,
        "weight_male_max": 40,
        "weight_female_min": 22,
        "weight_female_max": 32
    },
    "husky": {
        "en": "Siberian Husky",
        "cs": "Husky",
        "weight_male_min": 20,
        "weight_male_max": 27,
        "weight_female_min": 16,
        "weight_female_max": 23
    },
    "labrador": {
        "en": "Labrador Retriever",
        "cs": "Labrador",
        "weight_male_min": 29,
        "weight_male_max": 36,
        "weight_female_min": 25,
        "weight_female_max": 32
    },
    "malamute": {
        "en": "Alaskan Malamute",
        "cs": "Aljasky malamut",
        "weight_male_min": 38,
        "weight_male_max": 56,
        "weight_female_min": 34,
        "weight_female_max": 48
    },
    "pitbull": {
        "en": "Pitbull",
        "cs": "Pitbul",
        "weight_male_min": 16,
        "weight_male_max": 27,
        "weight_female_min": 14,
        "weight_female_max": 23
    },
    "poodle": {
        "en": "Poodle",
        "cs": "Pudl",
        "weight_male_min": 20,
        "weight_male_max": 32,
        "weight_female_min": 20,
        "weight_female_max": 32
    },
}


async def main():
    # Get DATABASE_URL from settings (Supabase connection)
    # Use DATABASE_URL_ASYNC and strip the driver suffix for asyncpg
    db_url = settings.DATABASE_URL_ASYNC
    # Replace postgresql+asyncpg:// with postgresql:// for asyncpg client
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    print("=== Seeding dog breeds ===")
    print(f"Connecting to Supabase database...")

    conn = await asyncpg.connect(db_url)

    try:
        created = 0
        skipped = 0

        for breed_name, data in sorted(BREED_DATA.items()):
            # Check if breed already exists
            existing = await conn.fetchrow(
                "SELECT id FROM breeds WHERE species = 'dog' AND name = $1",
                breed_name
            )

            if existing:
                print(f"OK: Breed '{breed_name}' already exists, skipping...")
                skipped += 1
                continue

            # Create new breed with weight ranges
            breed_id = uuid.uuid4()
            await conn.execute(
                """
                INSERT INTO breeds (
                    id, species, name,
                    weight_male_min, weight_male_max,
                    weight_female_min, weight_female_max,
                    created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                """,
                breed_id,
                "dog",
                breed_name,
                data['weight_male_min'],
                data['weight_male_max'],
                data['weight_female_min'],
                data['weight_female_max']
            )

            # Create translations
            for locale in ["en", "cs"]:
                await conn.execute(
                    """
                    INSERT INTO breeds_i18n (breed_id, locale, name, created_at, updated_at)
                    VALUES ($1, $2, $3, NOW(), NOW())
                    """,
                    breed_id,
                    locale,
                    data[locale]
                )

            print(f"CREATED: {data['en']} / {data['cs']} (male: {data['weight_male_min']}-{data['weight_male_max']}kg, female: {data['weight_female_min']}-{data['weight_female_max']}kg)")
            created += 1

        print()
        print("Summary:")
        print(f"  - Created: {created} breeds")
        print(f"  - Skipped: {skipped} breeds")
        print(f"  - Total: {created + skipped} dog breeds")
        print()
        print("SUCCESS: Breeds seeded!")
        print("You can now select these breeds when creating animals!")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())

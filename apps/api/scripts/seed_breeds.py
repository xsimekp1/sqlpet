"""
Script to seed basic breeds for the animals that were provided.
This creates breed records for the imported images.

Usage:
    python scripts/seed_breeds.py
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the src directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))

from sqlalchemy.ext.asyncio import AsyncSession
from src.app.core.config import settings
from src.app.models.breed import Breed
from src.app.models.animal import Species
from src.app.db.session import get_async_session


async def main():
    """Seed basic breeds for imported images"""

    # Extracted from the image filenames
    breeds_to_create = [
        # Dogs
        ("dog", "chihuahua"),
        ("dog", "daschhund"),
        ("dog", "german-shepherd"),
        ("dog", "husky"),
        ("dog", "labrador"),
        ("dog", "malamut"),
        ("dog", "pitbull"),
        ("dog", "poodle"),
    ]

    print("🌱 Seeding basic breeds for imported animal images...")

    async for db in get_async_session():
        for species_name, breed_name in breeds_to_create:
            try:
                # Check if breed already exists
                existing = await db.execute(
                    "SELECT id FROM breeds WHERE species = %s AND name = %s",
                    (species_name, breed_name),
                )
                if existing.scalar_one_or_none():
                    print(f"  ✅ Breed already exists: {species_name} / {breed_name}")
                    continue

                # Create new breed
                breed = Breed(species=Species(species_name), name=breed_name)

                db.add(breed)
                await db.flush()

                print(
                    f"  ➕ Created breed: {species_name} / {breed_name} (ID: {breed.id})"
                )

            except Exception as e:
                print(
                    f"  ❌ Failed to create breed {species_name}/{breed_name}: {str(e)}"
                )
                continue

        try:
            await db.commit()
            print(f"\n✅ Successfully seeded {len(breeds_to_create)} breeds!")

            # Show what we created
            result = await db.execute(
                "SELECT species, name FROM breeds ORDER BY species, name"
            )
            breeds = result.fetchall()
            print(f"\n📋 Available breeds:")
            for species, name in breeds:
                print(f"  🐕 {species} / {name}")

        except Exception as e:
            print(f"❌ Failed to commit: {str(e)}")
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())

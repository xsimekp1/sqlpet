# -*- coding: utf-8 -*-
"""
Script to seed breeds table from dog images in animals/ directory.
Extracts breed names from filenames and creates records with Czech translations.

Usage:
    cd apps/api
    python scripts/seed_breeds_from_images.py
"""

import asyncio
import os
import sys
from pathlib import Path
import uuid

# Add the src directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy import select
from src.app.core.config import settings

# Import all models to avoid relationship errors
import src.app.models  # This imports everything and registers all models
from src.app.models.breed import Breed
from src.app.models.breed_i18n import BreedI18n
from src.app.models.animal import Species


# Czech translations for dog breeds
BREED_TRANSLATIONS = {
    "beagle": {
        "en": "Beagle",
        "cs": "Bigl"
    },
    "chihuahua": {
        "en": "Chihuahua",
        "cs": "Civava"
    },
    "dachshund": {  # Note: filename has typo "daschhund"
        "en": "Dachshund",
        "cs": "Jezevcik"
    },
    "german-shepherd": {
        "en": "German Shepherd",
        "cs": "Nemecky ovcak"
    },
    "husky": {
        "en": "Siberian Husky",
        "cs": "Husky"
    },
    "labrador": {
        "en": "Labrador Retriever",
        "cs": "Labrador"
    },
    "malamute": {  # Note: filename has typo "malamut"
        "en": "Alaskan Malamute",
        "cs": "Aljasky malamut"
    },
    "pitbull": {
        "en": "Pitbull",
        "cs": "Pitbul"
    },
    "poodle": {
        "en": "Poodle",
        "cs": "Pudl"
    },
}


def parse_breed_from_filename(filename):
    """
    Parse breed name from filename like 'dog_labrador_black.png'
    Returns normalized breed name (e.g., 'labrador')
    """
    if not filename.startswith("dog_"):
        return None

    # Remove 'dog_' prefix and '.png' suffix
    parts = filename.replace("dog_", "").replace(".png", "").split("_")

    if len(parts) < 2:
        return None

    breed = parts[0]

    # Normalize typos in filenames
    if breed == "daschhund":
        breed = "dachshund"
    elif breed == "malamut":
        breed = "malamute"

    return breed


async def seed_breeds(db):
    """Seed breeds from image files"""

    # Path to the images directory (root of project)
    images_dir = Path(__file__).parent.parent.parent.parent / "animals"

    if not images_dir.exists():
        print("ERROR: Images directory not found:", images_dir)
        return

    print("Reading breed names from:", images_dir)

    # Extract unique breed names from filenames
    breed_names = set()
    for filename in os.listdir(images_dir):
        if filename.endswith(".png"):
            breed = parse_breed_from_filename(filename)
            if breed:
                breed_names.add(breed)

    print(f"Found {len(breed_names)} unique dog breeds:", sorted(breed_names))
    print()

    # Check existing breeds
    result = await db.execute(
        select(Breed).where(Breed.species == Species.DOG)
    )
    existing_breeds = {b.name: b for b in result.scalars().all()}

    created_count = 0
    updated_count = 0

    for breed_name in sorted(breed_names):
        if breed_name not in BREED_TRANSLATIONS:
            print(f"WARNING: No translation found for '{breed_name}', skipping...")
            continue

        translations = BREED_TRANSLATIONS[breed_name]

        # Check if breed already exists
        if breed_name in existing_breeds:
            print(f"OK: Breed '{breed_name}' already exists, skipping...")
            updated_count += 1
            continue

        # Create new breed record
        breed = Breed(
            id=uuid.uuid4(),
            species=Species.DOG,
            name=breed_name  # Store normalized English name as code
        )
        db.add(breed)
        await db.flush()  # Get the breed.id

        # Create translations for both locales
        for locale in ["en", "cs"]:
            translation = BreedI18n(
                breed_id=breed.id,
                locale=locale,
                name=translations[locale],
                description=None
            )
            db.add(translation)

        print(f"CREATED: {translations['en']} / {translations['cs']}")
        created_count += 1

    await db.commit()

    print()
    print("Summary:")
    print(f"  - Created: {created_count} breeds")
    print(f"  - Skipped (already exist): {updated_count} breeds")
    print(f"  - Total in database: {created_count + updated_count} dog breeds")


async def main():
    """Main function"""
    print("=== Seeding dog breeds from image files ===")
    print()

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL_ASYNC, echo=False)

    async with engine.begin() as conn:
        async with AsyncSession(conn, expire_on_commit=False) as db:
            try:
                await seed_breeds(db)
                print()
                print("SUCCESS: Breed seeding completed!")
                print("You can now select these breeds when creating new animals!")
            except Exception as e:
                print()
                print(f"ERROR during seeding: {str(e)}")
                import traceback
                traceback.print_exc()
                await db.rollback()
                raise

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

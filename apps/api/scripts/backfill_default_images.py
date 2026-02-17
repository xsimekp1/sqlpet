"""
Backfill default_image_url for existing animals.

Usage:
    python scripts/backfill_default_images.py

This script computes and saves default_image_url for all animals
that don't have a real photo (primary_photo_url is NULL).
"""

import asyncio
import uuid
from pathlib import Path

# Add parent dir to path for imports
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from src.app.core.config import settings
from src.app.models.animal import Animal
from src.app.models.animal_breed import AnimalBreed
from src.app.models.file import DefaultAnimalImage


async def compute_default_image_url(
    db: AsyncSession, species: str, breed_ids: list[uuid.UUID] | None, color: str | None
) -> str | None:
    """Compute default image URL based on species, breed, and color."""
    breed_id = breed_ids[0] if breed_ids else None

    queries = []
    if breed_id and color:
        queries.append(
            select(DefaultAnimalImage)
            .where(
                DefaultAnimalImage.species == species,
                DefaultAnimalImage.breed_id == breed_id,
                DefaultAnimalImage.color_pattern == color,
                DefaultAnimalImage.is_active == True,
            )
            .order_by(DefaultAnimalImage.priority.desc())
            .limit(1)
        )
    if breed_id:
        queries.append(
            select(DefaultAnimalImage)
            .where(
                DefaultAnimalImage.species == species,
                DefaultAnimalImage.breed_id == breed_id,
                DefaultAnimalImage.color_pattern.is_(None),
                DefaultAnimalImage.is_active == True,
            )
            .order_by(DefaultAnimalImage.priority.desc())
            .limit(1)
        )
    if color:
        queries.append(
            select(DefaultAnimalImage)
            .where(
                DefaultAnimalImage.species == species,
                DefaultAnimalImage.breed_id.is_(None),
                DefaultAnimalImage.color_pattern == color,
                DefaultAnimalImage.is_active == True,
            )
            .order_by(DefaultAnimalImage.priority.desc())
            .limit(1)
        )
    queries.append(
        select(DefaultAnimalImage)
        .where(
            DefaultAnimalImage.species == species,
            DefaultAnimalImage.breed_id.is_(None),
            DefaultAnimalImage.color_pattern.is_(None),
            DefaultAnimalImage.is_active == True,
        )
        .order_by(DefaultAnimalImage.priority.desc())
        .limit(1)
    )

    for q in queries:
        result = await db.execute(q)
        img = result.scalar_one_or_none()
        if img:
            return img.public_url

    return None


async def main():
    print("🚀 Starting backfill of default_image_url...")

    # Create async engine
    database_url = settings.DATABASE_URL_ASYNC
    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Get all animals without real photo and without default_image_url
        result = await db.execute(
            select(Animal).where(
                Animal.primary_photo_url.is_(None),
                Animal.default_image_url.is_(None),
                Animal.deleted_at.is_(None),
            )
        )
        animals = list(result.scalars().all())

        print(f"📋 Found {len(animals)} animals to process")

        updated_count = 0
        skipped_count = 0

        for i, animal in enumerate(animals):
            # Get breed IDs for this animal
            breed_result = await db.execute(
                select(AnimalBreed.breed_id).where(AnimalBreed.animal_id == animal.id)
            )
            breed_ids = list(breed_result.scalars().all())

            # Compute default image URL
            default_url = await compute_default_image_url(
                db,
                species=animal.species,
                breed_ids=breed_ids if breed_ids else None,
                color=animal.color,
            )

            if default_url:
                animal.default_image_url = default_url
                updated_count += 1
                if (i + 1) % 10 == 0:
                    print(f"  Processed {i + 1}/{len(animals)} animals...")
            else:
                skipped_count += 1
                print(
                    f"  ⚠️ No default image found for animal {animal.id} ({animal.name})"
                )

        # Commit changes
        await db.commit()

        print(
            f"\n✅ Done! Updated {updated_count} animals, skipped {skipped_count} (no default image available)"
        )


if __name__ == "__main__":
    asyncio.run(main())

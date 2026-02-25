"""
Seed breeds script - connects to any database via DATABASE_URL_ASYNC.
Run locally: python scripts/seed_breeds_simple.py
Run on Railway: railway run python scripts/seed_breeds_simple.py
"""

import os
import sys

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


async def seed_breeds():
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy import select, text
    from src.app.models.breed import Breed
    from src.app.models.animal import Species

    database_url = os.environ.get("DATABASE_URL_ASYNC") or os.environ.get(
        "DATABASE_URL"
    )

    if not database_url:
        print("ERROR: DATABASE_URL_ASYNC not set")
        print(
            "Run locally with Railway linked, or on Railway with: railway run python scripts/seed_breeds_simple.py"
        )
        sys.exit(1)

    # Convert to async
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    print(f"Connecting to database...")

    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    BREED_DATA: dict[str, list[str]] = {
        "dog": [
            "Mixed / Unknown",
            "Labrador Retriever",
            "German Shepherd",
            "Golden Retriever",
            "Beagle",
            "Bulldog",
            "Poodle",
            "Rottweiler",
            "Dachshund",
            "Boxer",
            "Siberian Husky",
            "Doberman Pinscher",
            "Chihuahua",
            "Border Collie",
            "Cocker Spaniel",
            "Jack Russell Terrier",
            "Czech Terrier",
            "Czechoslovakian Wolfdog",
            "Pražský Krysařík",
            "Yorkshire Terrier",
        ],
        "cat": [
            "Mixed / Unknown",
            "European Shorthair",
            "Persian",
            "Maine Coon",
            "Siamese",
            "British Shorthair",
            "Ragdoll",
            "Bengal",
            "Sphynx",
            "Russian Blue",
            "Norwegian Forest Cat",
            "Abyssinian",
            "Scottish Fold",
            "Birman",
            "Devon Rex",
        ],
        "rodent": [
            "Mixed / Unknown",
            "Holland Lop",
            "Mini Rex",
            "Netherland Dwarf",
            "Lionhead",
            "Flemish Giant",
            "English Lop",
            "Czech Red",
        ],
        "bird": [
            "Mixed / Unknown",
            "Budgerigar",
            "Cockatiel",
            "Canary",
            "Lovebird",
            "African Grey Parrot",
        ],
        "other": [
            "Mixed / Unknown",
        ],
    }

    async with async_session() as session:
        # Check existing breeds
        result = await session.execute(
            text("SELECT species, COUNT(*) FROM breeds GROUP BY species")
        )
        existing = {row[0]: row[1] for row in result.fetchall()}
        print(f"Existing breeds: {existing}")

        count = 0
        for species_str, breed_names in BREED_DATA.items():
            species = Species(species_str)
            for name in breed_names:
                # Check if breed exists
                result = await session.execute(
                    select(Breed).where(Breed.species == species, Breed.name == name)
                )
                if result.scalar_one_or_none() is None:
                    from uuid import uuid4

                    session.add(Breed(id=uuid4(), species=species, name=name))
                    count += 1

        await session.commit()
        print(f"Inserted {count} new breeds.")


if __name__ == "__main__":
    import asyncio
    from sqlalchemy.orm import sessionmaker

    asyncio.run(seed_breeds())

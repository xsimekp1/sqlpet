"""
Direct migration script - connects to Railway DB and runs the species rename.
Run: python scripts/direct_migration.py
"""

import os
import sys

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


async def run_migration():
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker

    # Get DATABASE_URL from Railway environment
    database_url = os.environ.get("DATABASE_URL_ASYNC") or os.environ.get(
        "DATABASE_URL"
    )

    if not database_url:
        print("ERROR: DATABASE_URL not set")
        print("On Railway, set DATABASE_URL_ASYNC in variables")
        print("Or run locally with: railway run python scripts/direct_migration.py")
        sys.exit(1)

    # Convert to async
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    print(f"Connecting to database...")

    engine = create_async_engine(database_url, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        print("Updating animals species...")
        await session.execute(
            "UPDATE animals SET species = 'rodent' WHERE species = 'rabbit'"
        )

        print("Updating inventory_items...")
        await session.execute(
            "UPDATE inventory_items SET target_species = 'rodent' WHERE target_species = 'rabbit'"
        )

        print("Updating food...")
        await session.execute(
            "UPDATE food SET target_species = 'rodent' WHERE target_species = 'rabbit'"
        )

        print("Altering enum type...")
        # PostgreSQL enum alteration
        await session.execute("ALTER TYPE species_enum RENAME TO species_enum_old")
        await session.execute(
            "CREATE TYPE species_enum AS ENUM ('dog', 'cat', 'rodent', 'bird', 'other')"
        )
        await session.execute(
            "ALTER TABLE animals ALTER COLUMN species TYPE species_enum USING species::text::species_enum"
        )

        await session.commit()

    print("Migration completed successfully!")


if __name__ == "__main__":
    import asyncio

    asyncio.run(run_migration())

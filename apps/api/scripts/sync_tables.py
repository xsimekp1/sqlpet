#!/usr/bin/env python3
"""
Database sync script - creates missing tables based on SQLAlchemy models.
Run on startup to ensure all tables exist.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

import asyncio
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)


def get_existing_tables(conn):
    result = conn.execute(
        text("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
    """)
    )
    return {row[0] for row in result.fetchall()}


def main():
    print("Checking database tables...")

    # Sync engine for checking tables
    sync_url = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    if not sync_url:
        sync_url = DATABASE_URL
    engine = create_engine(sync_url)

    with engine.connect() as conn:
        existing = get_existing_tables(conn)
        print(f"Existing tables: {len(existing)}")

        # Import Base and all models from models package
        from src.app.db.base import Base
        from src.app.models import (
            Organization,
            Animal,
            AnimalEvent,
            AnimalIdentifier,
            AnimalBreed,
            AnimalTag,
            AnimalWeightLog,
            AnimalBCSLog,
            User,
            Role,
            Permission,
            RolePermission,
            Membership,
            Breed,
            BreedI18n,
            Kennel,
            KennelStay,
            KennelPhoto,
            Intake,
            Task,
            Tag,
            File,
            AnimalPhoto,
            DefaultAnimalImage,
            AuditLog,
            Contact,
            FeedingPlan,
            FeedingLog,
            InventoryItem,
            InventoryLot,
            InventoryTransaction,
            HotelReservation,
        )

        # Try to import optional models
        try:
            from src.app.models.user_shortcut import UserShortcut
        except ImportError:
            pass
        try:
            from src.app.models.animal_vaccination import AnimalVaccination
        except ImportError:
            pass
        try:
            from src.app.models.incident import Incident, AnimalIncident
        except ImportError:
            pass
        try:
            from src.app.models.food import Food
        except ImportError:
            pass
        try:
            from src.app.models.finding import Finding
        except ImportError:
            pass
        try:
            from src.app.models.chat import ChatMessage
        except ImportError:
            pass
        try:
            from src.app.models.walk_log import WalkLog
        except ImportError:
            pass

        # Get all table names from metadata
        tables_in_models = set(Base.metadata.tables.keys())
        missing = tables_in_models - existing

        if missing:
            print(f"Missing tables: {sorted(missing)}")
            print("Creating missing tables...")

            # Use async engine to create tables
            async_url = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
            if (
                "postgresql+asyncpg://" not in async_url
                and "postgresql://" in async_url
            ):
                async_url = async_url.replace("postgresql://", "postgresql+asyncpg://")
            async_engine = create_async_engine(async_url)

            async def create_tables():
                async with async_engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)

            asyncio.run(create_tables())
            async_engine.dispose()
            print("Tables created successfully!")
        else:
            print("All tables exist.")

    engine.dispose()


if __name__ == "__main__":
    main()

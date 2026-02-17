#!/usr/bin/env python3
"""
Database sync script - creates missing tables and columns based on SQLAlchemy models.
Run on startup to ensure all tables and columns exist.
"""

import os
import sys

# Add parent directory to path for imports
script_dir = os.path.dirname(os.path.abspath(__file__))
api_dir = os.path.dirname(script_dir)
sys.path.insert(0, api_dir)
sys.path.insert(0, os.path.join(api_dir, "src"))

import asyncio
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import TypeEngine

# Use settings from the app
from src.app.core.config import settings

DATABASE_URL = settings.DATABASE_URL_ASYNC

if not DATABASE_URL:
    print("ERROR: DATABASE_URL_ASYNC not set")
    sys.exit(1)


def get_existing_tables(conn):
    result = conn.execute(
        text("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
    """)
    )
    return {row[0] for row in result.fetchall()}


def get_existing_columns(conn, table_name):
    result = conn.execute(
        text(f"""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = '{table_name}' AND table_schema = 'public'
    """)
    )
    return {row[0] for row in result.fetchall()}


def get_column_sql_type(col) -> str:
    """Map SQLAlchemy type to PostgreSQL column definition."""
    type_ = col.type

    if isinstance(type_, UUID):
        return "UUID"
    elif hasattr(type_, "length") and type_.length:
        return f"VARCHAR({type_.length})"
    elif hasattr(type_, "precision") and type_.precision:
        scale = getattr(type_, "scale", 0) or 0
        return f"NUMERIC({type_.precision}, {scale})"
    elif isinstance(type_, TypeEngine):
        type_name = str(type_).lower()
        if "text" in type_name:
            return "TEXT"
        elif "varchar" in type_name:
            return "VARCHAR(255)"
        elif "integer" in type_name or "int" in type_name:
            return "INTEGER"
        elif "numeric" in type_name:
            return "NUMERIC(10, 2)"
        elif "boolean" in type_name:
            return "BOOLEAN"
        elif "date" in type_name and "time" not in type_name:
            return "DATE"
        elif "time" in type_name:
            return "TIME"
        elif "timestamp" in type_name:
            return "TIMESTAMP"
        elif "float" in type_name or "double" in type_name:
            return "DOUBLE PRECISION"

    return "TEXT"


def main():
    print("Checking database schema...")

    # Sync engine for checking tables
    sync_url = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    if "postgresql+psycopg2://" not in sync_url:
        sync_url = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://")
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

        # Check for missing tables
        tables_in_models = set(Base.metadata.tables.keys())
        missing_tables = tables_in_models - existing

        if missing_tables:
            print(f"Missing tables: {sorted(missing_tables)}")
            print("Creating missing tables...")

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

        # Check for missing columns
        print("Checking for missing columns...")
        fixes_applied = 0

        for table_name, model in Base.metadata.tables.items():
            if table_name not in existing:
                continue

            db_cols = get_existing_columns(conn, table_name)
            model_cols = {c.name: c for c in model.columns}

            for col_name, col in model_cols.items():
                if col_name not in db_cols:
                    sql_type = get_column_sql_type(col)
                    nullable = "NULL" if col.nullable else "NOT NULL"

                    print(f"  Adding column: {table_name}.{col_name} ({sql_type})")

                    try:
                        conn.execute(
                            text(f"""
                            ALTER TABLE {table_name} 
                            ADD COLUMN {col_name} {sql_type} {nullable}
                        """)
                        )
                        fixes_applied += 1
                    except Exception as e:
                        print(f"    Error: {e}")

        if fixes_applied > 0:
            conn.commit()
            print(f"Added {fixes_applied} missing columns!")
        else:
            print("All columns exist.")

    engine.dispose()
    print("Database sync complete!")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Create missing tables that can't be auto-created due to FK issues.
Run on startup.
"""

import os
import sys

script_dir = os.path.dirname(os.path.abspath(__file__))
api_dir = os.path.dirname(script_dir)
sys.path.insert(0, api_dir)
sys.path.insert(0, os.path.join(api_dir, "src"))

import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from src.app.core.config import settings

DATABASE_URL = settings.DATABASE_URL_ASYNC

if not DATABASE_URL:
    print("ERROR: DATABASE_URL_ASYNC not set")
    sys.exit(1)


async def create_missing_tables():
    engine = create_async_engine(DATABASE_URL)

    async with engine.begin() as conn:
        # Check existing tables
        result = await conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
            )
        )
        existing = {row[0] for row in result.fetchall()}

        # Create animal_vaccinations if missing
        if "animal_vaccinations" not in existing:
            print("Creating animal_vaccinations table...")
            await conn.execute(
                text("""
                CREATE TABLE animal_vaccinations (
                    id UUID PRIMARY KEY,
                    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                    animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
                    vaccination_type VARCHAR(50) NOT NULL,
                    lot_id UUID REFERENCES inventory_lots(id) ON DELETE SET NULL,
                    lot_number VARCHAR(100),
                    administered_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    administered_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
                    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
                    notes TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            )
            await conn.execute(
                text(
                    "CREATE INDEX ix_animal_vaccinations_org ON animal_vaccinations(organization_id)"
                )
            )
            await conn.execute(
                text(
                    "CREATE INDEX ix_animal_vaccinations_animal ON animal_vaccinations(animal_id)"
                )
            )
            await conn.execute(
                text(
                    "CREATE INDEX ix_animal_vaccinations_lot ON animal_vaccinations(lot_id)"
                )
            )
            print("Created animal_vaccinations!")

        # Create animal_events if missing
        if "animal_events" not in existing:
            print("Creating animal_events table...")
            await conn.execute(
                text("""
                CREATE TABLE animal_events (
                    id UUID PRIMARY KEY,
                    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                    animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
                    event_type VARCHAR(50) NOT NULL,
                    event_date DATE NOT NULL,
                    title VARCHAR(255),
                    description TEXT,
                    related_animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
                    related_outcome_id UUID,
                    performed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            )
            await conn.execute(
                text(
                    "CREATE INDEX ix_animal_events_org ON animal_events(organization_id)"
                )
            )
            await conn.execute(
                text("CREATE INDEX ix_animal_events_animal ON animal_events(animal_id)")
            )
            print("Created animal_events!")

        print("Missing tables check complete!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_missing_tables())

#!/usr/bin/env python3
"""
Add enrichment columns to walk_logs table.
Run locally or on Railway: python scripts/add_enrichment_columns.py
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


async def main():
    print("Adding enrichment columns to walk_logs table...")

    DATABASE_URL = settings.DATABASE_URL_ASYNC
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL_ASYNC not set")
        sys.exit(1)

    engine = create_async_engine(DATABASE_URL)

    async with engine.begin() as conn:
        # Check if columns exist
        result = await conn.execute(
            text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'walk_logs' 
                AND table_schema = 'public'
            """)
        )
        existing_columns = {row[0] for row in result.fetchall()}
        print(f"Existing columns: {existing_columns}")

        # Add enrichment_types if not exists
        if "enrichment_types" not in existing_columns:
            print("Adding column: enrichment_types")
            await conn.execute(
                text("ALTER TABLE walk_logs ADD COLUMN enrichment_types VARCHAR(50)[]")
            )
            print("✓ enrichment_types added")
        else:
            print("✓ enrichment_types already exists")

        # Add intensity if not exists
        if "intensity" not in existing_columns:
            print("Adding column: intensity")
            await conn.execute(
                text("ALTER TABLE walk_logs ADD COLUMN intensity VARCHAR(20)")
            )
            print("✓ intensity added")
        else:
            print("✓ intensity already exists")

        # Add reaction if not exists
        if "reaction" not in existing_columns:
            print("Adding column: reaction")
            await conn.execute(
                text("ALTER TABLE walk_logs ADD COLUMN reaction VARCHAR(20)")
            )
            print("✓ reaction added")
        else:
            print("✓ reaction already exists")

    print("\nDone! Enrichment columns ready.")


if __name__ == "__main__":
    asyncio.run(main())

"""
Simple script to add organization columns directly via SQL.
Run this on Railway: railway run python scripts/add_org_columns.py
"""

import os
import asyncio
from sqlalchemy import text
from src.app.db.session import AsyncSessionLocal


async def add_columns():
    """Add missing columns to organizations table."""
    async with AsyncSessionLocal() as db:
        try:
            # Add columns one by one
            columns = [
                ("registration_number", "VARCHAR(20)"),
                ("address", "TEXT"),
                ("lat", "FLOAT"),
                ("lng", "FLOAT"),
                ("capacity_dogs", "INTEGER"),
                ("capacity_cats", "INTEGER"),
                ("capacity_rabbits", "INTEGER"),
                ("capacity_small", "INTEGER"),
                ("capacity_birds", "INTEGER"),
            ]

            for col_name, col_type in columns:
                try:
                    await db.execute(
                        text(
                            f"ALTER TABLE organizations ADD COLUMN {col_name} {col_type}"
                        )
                    )
                    print(f"✓ Added {col_name}")
                except Exception as e:
                    if "already exists" in str(e).lower():
                        print(f"- {col_name} already exists")
                    else:
                        print(f"✗ {col_name}: {e}")

            await db.commit()
            print("Done!")

        except Exception as e:
            print(f"Error: {e}")
            await db.rollback()


if __name__ == "__main__":
    asyncio.run(add_columns())

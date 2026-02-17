"""
Create api_metrics table if it doesn't exist.

Usage:
    python scripts/create_api_metrics_table.py
"""

import asyncio
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from src.app.core.config import settings


async def main():
    print("🚀 Creating api_metrics table if needed...")

    database_url = settings.DATABASE_URL_ASYNC
    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Check if table exists
        result = await db.execute(
            text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'api_metrics'
            )
        """)
        )
        exists = result.scalar()

        if exists:
            print("✓ Table api_metrics already exists")
        else:
            # Create table
            await db.execute(
                text("""
                CREATE TABLE api_metrics (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    organization_id VARCHAR(36),
                    user_id VARCHAR(36),
                    method VARCHAR(10) NOT NULL,
                    path VARCHAR(500) NOT NULL,
                    status_code INTEGER NOT NULL,
                    duration_ms INTEGER NOT NULL,
                    db_ms INTEGER,
                    query_count INTEGER,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            )

            await db.commit()
            print("✓ Table api_metrics created successfully")

        # Add indexes for better query performance
        indexes = [
            (
                "idx_api_metrics_org_id",
                "CREATE INDEX IF NOT EXISTS idx_api_metrics_org_id ON api_metrics(organization_id)",
            ),
            (
                "idx_api_metrics_created_at",
                "CREATE INDEX IF NOT EXISTS idx_api_metrics_created_at ON api_metrics(created_at)",
            ),
            (
                "idx_api_metrics_path",
                "CREATE INDEX IF NOT EXISTS idx_api_metrics_path ON api_metrics(path)",
            ),
            (
                "idx_api_metrics_status",
                "CREATE INDEX IF NOT EXISTS idx_api_metrics_status ON api_metrics(status_code)",
            ),
        ]

        for idx_name, idx_sql in indexes:
            try:
                await db.execute(text(idx_sql))
                print(f"✓ Index {idx_name} ready")
            except Exception as e:
                print(f"  Index {idx_name}: {e}")

        await db.commit()

        # Add indexes to kennel_stays for faster joins
        kennel_indexes = [
            (
                "idx_kennel_stays_animal_id",
                "CREATE INDEX IF NOT EXISTS idx_kennel_stays_animal_id ON kennel_stays(animal_id)",
            ),
            (
                "idx_kennel_stays_kennel_id",
                "CREATE INDEX IF NOT EXISTS idx_kennel_stays_kennel_id ON kennel_stays(kennel_id)",
            ),
            (
                "idx_kennel_stays_active",
                "CREATE INDEX IF NOT EXISTS idx_kennel_stays_active ON kennel_stays(animal_id) WHERE end_at IS NULL",
            ),
        ]

        for idx_name, idx_sql in kennel_indexes:
            try:
                await db.execute(text(idx_sql))
                print(f"✓ Index {idx_name} ready")
            except Exception as e:
                print(f"  Index {idx_name}: {e}")

        await db.commit()
        print("✅ All indexes ready!")

    await engine.dispose()
    print("✅ Done!")


if __name__ == "__main__":
    asyncio.run(main())

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

            # Create indexes
            await db.execute(
                text("""
                CREATE INDEX idx_api_metrics_org_id ON api_metrics(organization_id)
            """)
            )
            await db.execute(
                text("""
                CREATE INDEX idx_api_metrics_created_at ON api_metrics(created_at)
            """)
            )

            await db.commit()
            print("✓ Table api_metrics created successfully")

    await engine.dispose()
    print("✅ Done!")


if __name__ == "__main__":
    asyncio.run(main())

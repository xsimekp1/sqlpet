from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from src.app.api.dependencies.db import get_db

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/db")
async def health_db(db: AsyncSession = Depends(get_db)):
    await db.execute(text("SELECT 1"))
    return {"status": "ok"}


@router.get("/debug/tables")
async def debug_tables(db: AsyncSession = Depends(get_db)):
    """Debug endpoint to list all tables in the database"""
    result = await db.execute(text("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    """))
    tables = [row[0] for row in result.fetchall()]

    # Check specific tables
    animal_tags_exists = await db.execute(text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'animal_tags')"
    ))
    tags_exists = await db.execute(text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tags')"
    ))

    # Check alembic version
    alembic_result = await db.execute(text("SELECT version_num FROM alembic_version"))
    alembic_versions = [row[0] for row in alembic_result.fetchall()]

    return {
        "all_tables": tables,
        "animal_tags_exists": animal_tags_exists.scalar(),
        "tags_exists": tags_exists.scalar(),
        "alembic_versions": alembic_versions,
    }

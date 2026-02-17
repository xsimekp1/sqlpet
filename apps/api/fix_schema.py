import asyncio
import os
import sys
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import DeclarativeMeta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from src.app.models import Base


DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://pet:pet@localhost:5432/petdb"
)


def get_column_sql_type(col) -> str:
    """Map SQLAlchemy type to PostgreSQL column definition."""
    type_ = col.type

    if isinstance(type_, UUID):
        return "UUID"
    elif isinstance(type_, String):
        length = type_.length or 255
        return f"VARCHAR({length})"
    elif isinstance(type_, Text):
        return "TEXT"
    elif isinstance(type_, Integer):
        return "INTEGER"
    elif isinstance(type_, Numeric):
        precision = type_.precision or 10
        scale = type_.scale or 2
        return f"NUMERIC({precision}, {scale})"
    elif isinstance(type_, Float):
        return "DOUBLE PRECISION"
    elif isinstance(type_, Boolean):
        return "BOOLEAN"
    elif isinstance(type_, Date):
        return "DATE"
    elif isinstance(type_, Time):
        return "TIME"
    elif isinstance(type_, DateTime):
        return "TIMESTAMP"
    elif isinstance(type_, Enum):
        return "VARCHAR(50)"
    else:
        return "TEXT"


async def fix_schema():
    engine = create_async_engine(DATABASE_URL)

    async with engine.begin() as conn:
        result = await conn.execute(
            text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        )
        existing_tables = {row[0] for row in result.fetchall()}

        async def get_columns(table_name: str) -> dict:
            result = await conn.execute(
                text(f"""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = '{table_name}'
            """)
            )
            return {
                row[0]: {"type": row[1], "nullable": row[2], "default": row[3]}
                for row in result.fetchall()
            }

        print("=" * 60)
        print("SCHEMA FIXER - Comparing models with database")
        print("=" * 60)

        fixes_applied = 0

        for table_name, model in Base.metadata.tables.items():
            print(f"\n{table_name}:")

            if table_name not in existing_tables:
                print(f"  ❌ Table doesn't exist - skipping")
                continue

            db_cols = await get_columns(table_name)
            model_cols = {c.name: c for c in model.columns}

            for col_name, col in model_cols.items():
                sql_type = get_column_sql_type(col)
                nullable = "YES" if col.nullable else "NO"

                if col_name not in db_cols:
                    default = "NULL"
                    if col.default and hasattr(col.default, "arg"):
                        default = (
                            f"'{col.default.arg}'"
                            if isinstance(col.default.arg, str)
                            else str(col.default.arg)
                        )

                    print(
                        f"  ➕ Adding column: {col_name} ({sql_type}) nullable={nullable}"
                    )

                    try:
                        await conn.execute(
                            text(f"""
                            ALTER TABLE {table_name} 
                            ADD COLUMN {col_name} {sql_type}
                        """)
                        )
                        fixes_applied += 1
                    except Exception as e:
                        print(f"     Error: {e}")
                else:
                    print(f"  ✓ {col_name}")

        print("\n" + "=" * 60)
        print(f"Done! Applied {fixes_applied} schema fixes.")
        print("=" * 60)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(fix_schema())

"""
Run Alembic migration on Railway production database.
Usage: python scripts/run_migration_on_railway.py
"""

import os
import sys
import subprocess


def main():
    # Check if DATABASE_URL is set
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set")
        print("Set it with: export DATABASE_URL='your-railway-db-url'")
        sys.exit(1)

    print(f"Using DATABASE_URL: {db_url[:30]}...")

    # Run alembic upgrade head
    result = subprocess.run(
        ["python", "-m", "alembic", "upgrade", "head"],
        env={**os.environ, "DATABASE_URL": db_url},
        capture_output=True,
        text=True,
    )

    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

    if result.returncode != 0:
        print(f"Migration failed with code {result.returncode}")
        sys.exit(1)

    print("Migration completed successfully!")


if __name__ == "__main__":
    main()

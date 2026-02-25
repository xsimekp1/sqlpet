"""
Railway migration script for adding phone and admin_note to organizations.
Run this after deploying the new code: railway run python scripts/run_migrations_railway.py
"""

import subprocess
import sys


def run_migration():
    print("Running migrations...")
    try:
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
        )
        print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        if result.returncode != 0:
            print(f"Migration failed with code {result.returncode}")
            return False
        print("Migration completed successfully!")
        return True
    except FileNotFoundError:
        print("Error: alembic not found", file=sys.stderr)
        return False


if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)

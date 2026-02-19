"""
Alembic upgrade script for Railway deployment.
Run migrations programmatically without alembic CLI.
"""

import os
import sys

# Add the project root to path
sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from alembic.config import Config
from alembic import command


def upgrade():
    """Run alembic upgrade head."""
    # Get the alembic.ini path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    alembic_ini = os.path.join(project_root, "alembic.ini")

    if not os.path.exists(alembic_ini):
        print(f"alembic.ini not found at {alembic_ini}")
        sys.exit(1)

    # Set up config
    cfg = Config(alembic_ini)

    # Run upgrade
    print("Running alembic upgrade head...")
    command.upgrade(cfg, "head")
    print("Migrations completed successfully")


if __name__ == "__main__":
    upgrade()

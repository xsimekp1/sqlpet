"""fix_enum_values_lowercase

Revision ID: d7e6405d8340
Revises: 73687aa07f55
Create Date: 2026-02-11 17:30:27.739334

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d7e6405d8340"
down_revision: Union[str, Sequence[str], None] = "73687aa07f55"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix enum values from uppercase to lowercase."""

    # Update existing data to lowercase first
    op.execute(
        "UPDATE kennels SET size_category = 'small' WHERE size_category = 'SMALL'"
    )
    op.execute(
        "UPDATE kennels SET size_category = 'medium' WHERE size_category = 'MEDIUM'"
    )
    op.execute(
        "UPDATE kennels SET size_category = 'large' WHERE size_category = 'LARGE'"
    )
    op.execute(
        "UPDATE kennels SET size_category = 'xlarge' WHERE size_category = 'XLARGE'"
    )

    op.execute("UPDATE kennels SET type = 'indoor' WHERE type = 'INDOOR'")
    op.execute("UPDATE kennels SET type = 'outdoor' WHERE type = 'OUTDOOR'")
    op.execute("UPDATE kennels SET type = 'isolation' WHERE type = 'ISOLATION'")
    op.execute("UPDATE kennels SET type = 'quarantine' WHERE type = 'QUARANTINE'")

    op.execute("UPDATE kennels SET status = 'available' WHERE status = 'AVAILABLE'")
    op.execute("UPDATE kennels SET status = 'maintenance' WHERE status = 'MAINTENANCE'")
    op.execute("UPDATE kennels SET status = 'closed' WHERE status = 'CLOSED'")

    # Drop and recreate enums with lowercase values
    op.execute("DROP TYPE IF EXISTS kennel_size_category CASCADE")
    op.execute("DROP TYPE IF EXISTS kennel_type CASCADE")
    op.execute("DROP TYPE IF EXISTS kennel_status CASCADE")

    op.execute(
        "CREATE TYPE kennel_size_category AS ENUM ('small', 'medium', 'large', 'xlarge')"
    )
    op.execute(
        "CREATE TYPE kennel_type AS ENUM ('indoor', 'outdoor', 'isolation', 'quarantine')"
    )
    op.execute(
        "CREATE TYPE kennel_status AS ENUM ('available', 'maintenance', 'closed')"
    )


def downgrade() -> None:
    """Downgrade schema."""

    # Update data back to uppercase
    op.execute(
        "UPDATE kennels SET size_category = 'SMALL' WHERE size_category = 'small'"
    )
    op.execute(
        "UPDATE kennels SET size_category = 'MEDIUM' WHERE size_category = 'medium'"
    )
    op.execute(
        "UPDATE kennels SET size_category = 'LARGE' WHERE size_category = 'large'"
    )
    op.execute(
        "UPDATE kennels SET size_category = 'XLARGE' WHERE size_category = 'xlarge'"
    )

    op.execute("UPDATE kennels SET type = 'INDOOR' WHERE type = 'indoor'")
    op.execute("UPDATE kennels SET type = 'OUTDOOR' WHERE type = 'outdoor'")
    op.execute("UPDATE kennels SET type = 'ISOLATION' WHERE type = 'isolation'")
    op.execute("UPDATE kennels SET type = 'QUARANTINE' WHERE type = 'quarantine'")

    op.execute("UPDATE kennels SET status = 'AVAILABLE' WHERE status = 'available'")
    op.execute("UPDATE kennels SET status = 'MAINTENANCE' WHERE status = 'maintenance'")
    op.execute("UPDATE kennels SET status = 'CLOSED' WHERE status = 'closed'")

    # Recreate uppercase enums
    op.execute("DROP TYPE IF EXISTS kennel_size_category CASCADE")
    op.execute("DROP TYPE IF EXISTS kennel_type CASCADE")
    op.execute("DROP TYPE IF EXISTS kennel_status CASCADE")

    op.execute(
        "CREATE TYPE kennel_size_category AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'XLARGE')"
    )
    op.execute(
        "CREATE TYPE kennel_type AS ENUM ('INDOOR', 'OUTDOOR', 'ISOLATION', 'QUARANTINE')"
    )
    op.execute(
        "CREATE TYPE kennel_status AS ENUM ('AVAILABLE', 'MAINTENANCE', 'CLOSED')"
    )

"""fix_kennel_enum_types

Revision ID: 73687aa07f55
Revises: 70854ebecd4a
Create Date: 2026-02-11 16:31:39.883137

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "73687aa07f55"
down_revision: Union[str, Sequence[str], None] = "70854ebecd4a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix enum types to lowercase values."""

    # Drop existing enum types if they exist with uppercase values
    op.execute("DROP TYPE IF EXISTS kennel_size_category CASCADE")
    op.execute("DROP TYPE IF EXISTS kennel_type CASCADE")
    op.execute("DROP TYPE IF EXISTS kennel_status CASCADE")

    # Create new enum types with lowercase values
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
    # Drop lowercase enums
    op.execute("DROP TYPE IF EXISTS kennel_size_category CASCADE")
    op.execute("DROP TYPE IF EXISTS kennel_type CASCADE")
    op.execute("DROP TYPE IF EXISTS kennel_status CASCADE")

    # Recreate uppercase enums
    op.execute(
        "CREATE TYPE kennel_size_category AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'XLARGE')"
    )
    op.execute(
        "CREATE TYPE kennel_type AS ENUM ('INDOOR', 'OUTDOOR', 'ISOLATION', 'QUARANTINE')"
    )
    op.execute(
        "CREATE TYPE kennel_status AS ENUM ('AVAILABLE', 'MAINTENANCE', 'CLOSED')"
    )

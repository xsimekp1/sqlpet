"""convert_identifier_type_to_varchar

Revision ID: 993ea23d5955
Revises: 232a6827a49b
Create Date: 2026-02-11 22:25:27.085005

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '993ea23d5955'
down_revision: Union[str, Sequence[str], None] = '232a6827a49b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Convert identifier type from ENUM to VARCHAR with lowercase values."""

    # Convert the type column from ENUM to VARCHAR and lowercase the values
    op.execute(
        "ALTER TABLE animal_identifiers ALTER COLUMN type TYPE VARCHAR(50) USING lower(type::text)"
    )


def downgrade() -> None:
    """Convert back to ENUM (not recommended)."""

    # Update values back to uppercase
    op.execute(
        "UPDATE animal_identifiers SET type = upper(type) WHERE type IS NOT NULL"
    )

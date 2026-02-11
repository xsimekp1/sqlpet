"""add_current_kennel_id_to_animals

Revision ID: c7a8f9e0d1b2
Revises: 0f7eaabd74a6
Create Date: 2026-02-11 18:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c7a8f9e0d1b2"
down_revision: Union[str, Sequence[str], None] = "0f7eaabd74a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add current_kennel_id column to animals table."""

    # Add current_kennel_id column
    op.add_column(
        "animals", sa.Column("current_kennel_id", sa.UUID(as_uuid=True), nullable=True)
    )

    # Create foreign key constraint
    op.create_foreign_key(
        "fk_animals_current_kennel_id",
        "animals",
        "kennels",
        ["current_kennel_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Create index for better performance
    op.create_index("ix_animals_current_kennel_id", "animals", ["current_kennel_id"])


def downgrade() -> None:
    """Remove current_kennel_id column from animals table."""

    # Drop index
    op.drop_index("ix_animals_current_kennel_id", table_name="animals")

    # Drop foreign key constraint
    op.drop_constraint("fk_animals_current_kennel_id", "animals", type_="foreignkey")

    # Drop column
    op.drop_column("animals", "current_kennel_id")

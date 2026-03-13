"""make document_instances.animal_id nullable

Revision ID: be6d3200e70a
Revises: f55e241d5d4a
Create Date: 2026-03-12 18:32:24.332875

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "be6d3200e70a"
down_revision: Union[str, Sequence[str], None] = "f55e241d5d4a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        "document_instances",
        "animal_id",
        existing_type=sa.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "document_instances",
        "animal_id",
        existing_type=sa.UUID(as_uuid=True),
        nullable=False,
    )

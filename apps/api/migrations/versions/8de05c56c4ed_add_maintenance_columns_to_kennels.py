"""add maintenance columns to kennels

Revision ID: 8de05c56c4ed
Revises: add_medical_status_columns
Create Date: 2026-02-18 15:11:15.797285

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8de05c56c4ed"
down_revision: Union[str, Sequence[str], None] = "add_enrichment_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "kennels", sa.Column("maintenance_start_at", sa.DateTime, nullable=True)
    )
    op.add_column(
        "kennels", sa.Column("maintenance_end_at", sa.DateTime, nullable=True)
    )
    op.add_column(
        "kennels", sa.Column("maintenance_reason", sa.String(500), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    pass

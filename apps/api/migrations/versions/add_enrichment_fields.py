"""Add enrichment fields to walk_logs

Revision ID: add_enrichment_fields
Revises:
Create Date: 2026-02-18

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_enrichment_fields"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "walk_logs",
        sa.Column("enrichment_types", postgresql.ARRAY(sa.String(50)), nullable=True),
    )
    op.add_column("walk_logs", sa.Column("intensity", sa.String(20), nullable=True))
    op.add_column("walk_logs", sa.Column("reaction", sa.String(20), nullable=True))


def downgrade():
    op.drop_column("walk_logs", "reaction")
    op.drop_column("walk_logs", "intensity")
    op.drop_column("walk_logs", "enrichment_types")

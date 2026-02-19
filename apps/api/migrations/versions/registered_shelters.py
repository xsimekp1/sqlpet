"""Create registered_shelters table

Revision ID: registered_shelters
Revises:
Create Date: 2026-02-19
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "registered_shelters"
down_revision = "ec751ac4716d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "registered_shelters",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("registration_number", sa.String(20), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("region", sa.String(100), nullable=False),
        sa.Column("activity_type", sa.String(255), nullable=True),
        sa.Column("capacity", sa.Text(), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("registration_date", sa.Date(), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("registration_number"),
    )
    op.create_index(
        "ix_registered_shelters_registration_number",
        "registered_shelters",
        ["registration_number"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_registered_shelters_registration_number", table_name="registered_shelters"
    )
    op.drop_table("registered_shelters")

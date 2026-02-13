"""Add animal_weight_logs table

Revision ID: add_weight_logs
Revises: add_is_pregnant
Create Date: 2026-02-13

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "add_weight_logs"
down_revision = "add_is_pregnant"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "animal_weight_logs",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "animal_id",
            UUID(as_uuid=True),
            sa.ForeignKey("animals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("weight_kg", sa.Numeric(6, 2), nullable=False),
        sa.Column(
            "measured_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "stay_id",
            UUID(as_uuid=True),
            sa.ForeignKey("kennel_stays.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "recorded_by_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "idx_weight_logs_animal",
        "animal_weight_logs",
        ["animal_id", "measured_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_weight_logs_animal", table_name="animal_weight_logs")
    op.drop_table("animal_weight_logs")

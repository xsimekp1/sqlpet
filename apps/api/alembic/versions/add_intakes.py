"""Add intakes table

Revision ID: add_intakes
Revises: add_behavior_notes
Create Date: 2026-02-14

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_intakes"
down_revision = "add_behavior_notes"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "intakes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "animal_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("animals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reason", sa.String(50), nullable=False),
        sa.Column("intake_date", sa.Date(), nullable=False),
        sa.Column(
            "finder_person_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("contacts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("finder_notes", sa.Text(), nullable=True),
        sa.Column("planned_end_date", sa.Date(), nullable=True),
        sa.Column(
            "planned_person_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("contacts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("funding_source", sa.String(255), nullable=True),
        sa.Column("funding_notes", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("idx_intakes_org", "intakes", ["organization_id"])
    op.create_index("idx_intakes_animal", "intakes", ["animal_id"])


def downgrade():
    op.drop_index("idx_intakes_animal", table_name="intakes")
    op.drop_index("idx_intakes_org", table_name="intakes")
    op.drop_table("intakes")

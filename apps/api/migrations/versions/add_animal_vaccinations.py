"""add animal_vaccinations table

Revision ID: add_animal_vaccinations
Revises:
Create Date: 2026-02-16 19:00:00.000000

"""

from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_animal_vaccinations"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "animal_vaccinations",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "organization_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "animal_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("animals.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("vaccination_type", sa.String(50), nullable=False),
        sa.Column(
            "lot_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("inventory_lots.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("lot_number", sa.String(100), nullable=True),
        sa.Column("administered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "administered_by_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "task_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("notes", sa.Text, nullable=True),
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
    )
    op.create_index(
        "ix_animal_vaccinations_organization_id",
        "animal_vaccinations",
        ["organization_id"],
    )
    op.create_index(
        "ix_animal_vaccinations_animal_id", "animal_vaccinations", ["animal_id"]
    )
    op.create_index("ix_animal_vaccinations_lot_id", "animal_vaccinations", ["lot_id"])


def downgrade() -> None:
    op.drop_index("ix_animal_vaccinations_lot_id", table_name="animal_vaccinations")
    op.drop_index("ix_animal_vaccinations_animal_id", table_name="animal_vaccinations")
    op.drop_index(
        "ix_animal_vaccinations_organization_id", table_name="animal_vaccinations"
    )
    op.drop_table("animal_vaccinations")

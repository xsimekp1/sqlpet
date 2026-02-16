"""add findings table

Revision ID: 9409224bccf4
Revises: add_intake_outcome_dates
Create Date: 2026-02-16 16:36:07.839463

"""

from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9409224bccf4"
down_revision: Union[str, Sequence[str], None] = "add_intake_outcome_dates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "findings",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "organization_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "who_found_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("contacts.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("where_lat", sa.Float, nullable=True),
        sa.Column("where_lng", sa.Float, nullable=True),
        sa.Column("when_found", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "animal_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("animals.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
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
    op.create_index("ix_findings_organization_id", "findings", ["organization_id"])
    op.create_index("ix_findings_who_found_id", "findings", ["who_found_id"])
    op.create_index("ix_findings_animal_id", "findings", ["animal_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_findings_animal_id", table_name="findings")
    op.drop_index("ix_findings_who_found_id", table_name="findings")
    op.drop_index("ix_findings_organization_id", table_name="findings")
    op.drop_table("findings")

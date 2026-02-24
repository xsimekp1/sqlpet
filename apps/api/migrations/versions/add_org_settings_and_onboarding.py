"""add_org_settings_and_onboarding

Revision ID: a9b8c7d6e5f4
Revises: 428ccd620610
Create Date: 2026-02-24 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "a9b8c7d6e5f4"
down_revision: Union[str, Sequence[str], None] = "428ccd620610"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add settings JSONB and onboarding_completed_at to organizations."""
    op.add_column(
        "organizations",
        sa.Column("settings", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column(
            "onboarding_completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Remove settings and onboarding_completed_at from organizations."""
    op.drop_column("organizations", "onboarding_completed_at")
    op.drop_column("organizations", "settings")

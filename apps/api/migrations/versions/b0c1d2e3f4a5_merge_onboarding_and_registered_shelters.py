"""merge_onboarding_and_registered_shelters

Revision ID: b0c1d2e3f4a5
Revises: a9b8c7d6e5f4, f1a2b3c4d5e6
Create Date: 2026-02-24 10:05:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b0c1d2e3f4a5"
down_revision: Union[str, Sequence[str], None] = ("a9b8c7d6e5f4", "f1a2b3c4d5e6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Merge migration — no schema changes."""


def downgrade() -> None:
    """Merge migration — no schema changes."""

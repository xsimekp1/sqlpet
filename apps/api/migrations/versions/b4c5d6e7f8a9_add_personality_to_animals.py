"""add_personality_to_animals

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-02-26 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b4c5d6e7f8a9"
down_revision: Union[str, Sequence[str], None] = "a3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add personality JSONB column for animal personality traits."""
    op.add_column(
        "animals",
        sa.Column("personality", sa.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    """Remove personality column."""
    op.drop_column("animals", "personality")

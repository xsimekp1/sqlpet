"""Merge all migration heads

Revision ID: merge_all_heads
Revises: 008_add_animal_tags, add_kennel_map_layout, merge_two_heads
Create Date: 2026-02-17 14:30:00

"""

from typing import Sequence, Union

from alembic import op

revision: str = "merge_all_heads"
down_revision: Union[str, Sequence[str], None] = (
    "008_add_animal_tags",
    "add_kennel_map_layout",
    "merge_two_heads",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

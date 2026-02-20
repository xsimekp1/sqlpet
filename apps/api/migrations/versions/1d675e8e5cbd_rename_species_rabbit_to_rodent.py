"""rename_species_rabbit_to_rodent

Revision ID: 1d675e8e5cbd
Revises: b36400f933ef
Create Date: 2026-02-20 17:03:48.920508

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1d675e8e5cbd"
down_revision: Union[str, Sequence[str], None] = "b36400f933ef"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - rename rabbit to rodent in all tables."""
    op.execute("UPDATE animals SET species = 'rodent' WHERE species = 'rabbit'")
    op.execute(
        "UPDATE animals SET species = 'rodent' WHERE species = 'rodent'"
    )  # Already renamed, no-op for idempotency
    op.execute(
        "UPDATE inventory_items SET target_species = 'rodent' WHERE target_species = 'rabbit'"
    )
    op.execute(
        "UPDATE food SET target_species = 'rodent' WHERE target_species = 'rabbit'"
    )


def downgrade() -> None:
    """Downgrade schema - rename rodent back to rabbit."""
    op.execute("UPDATE animals SET species = 'rabbit' WHERE species = 'rodent'")
    op.execute(
        "UPDATE inventory_items SET target_species = 'rabbit' WHERE target_species = 'rodent'"
    )
    op.execute(
        "UPDATE food SET target_species = 'rabbit' WHERE target_species = 'rodent'"
    )

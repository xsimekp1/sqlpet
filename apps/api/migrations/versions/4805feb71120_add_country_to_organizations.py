"""add_country_to_organizations

Revision ID: 4805feb71120
Revises: b0c1d2e3f4a5
Create Date: 2026-02-25 12:39:00.588750

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4805feb71120"
down_revision: Union[str, Sequence[str], None] = "b0c1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("organizations", sa.Column("country", sa.String(2), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("organizations", "country")

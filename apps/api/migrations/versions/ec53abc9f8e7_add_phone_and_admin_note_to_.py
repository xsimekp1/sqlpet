"""add_phone_and_admin_note_to_organizations

Revision ID: ec53abc9f8e7
Revises: f18870d8d23a
Create Date: 2026-02-25 17:05:22.111901

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ec53abc9f8e7"
down_revision: Union[str, Sequence[str], None] = "f18870d8d23a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("organizations", sa.Column("phone", sa.String(20), nullable=True))
    op.add_column("organizations", sa.Column("admin_note", sa.Text, nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("organizations", "admin_note")
    op.drop_column("organizations", "phone")

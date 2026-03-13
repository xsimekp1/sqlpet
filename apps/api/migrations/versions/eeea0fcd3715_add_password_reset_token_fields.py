"""add_password_reset_token_fields

Revision ID: eeea0fcd3715
Revises: d8b4fe7362b0
Create Date: 2026-03-13 10:05:18.826356

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "eeea0fcd3715"
down_revision: Union[str, Sequence[str], None] = "d8b4fe7362b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "users", sa.Column("password_reset_token", sa.String(64), nullable=True)
    )
    op.add_column(
        "users", sa.Column("password_reset_expires", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "password_reset_expires")
    op.drop_column("users", "password_reset_token")

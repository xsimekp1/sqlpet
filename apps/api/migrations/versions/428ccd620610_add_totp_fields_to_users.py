"""add_totp_fields_to_users

Revision ID: 428ccd620610
Revises: e5f6a7b8c9d0
Create Date: 2026-02-23 13:02:04.302345

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "428ccd620610"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("users", sa.Column("totp_secret", sa.String(32), nullable=True))
    op.add_column(
        "users",
        sa.Column("totp_enabled", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column("users", sa.Column("backup_codes", sa.String(255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "backup_codes")
    op.drop_column("users", "totp_enabled")
    op.drop_column("users", "totp_secret")

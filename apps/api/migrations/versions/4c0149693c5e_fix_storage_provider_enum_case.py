"""fix_storage_provider_enum_case

Revision ID: 4c0149693c5e
Revises: add_medical_status_columns
Create Date: 2026-02-18 17:52:29.733344

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4c0149693c5e"
down_revision: Union[str, Sequence[str], None] = "add_medical_status_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix storage_provider enum: change SUPABASE -> supabase"""
    op.execute(
        "UPDATE files SET storage_provider = 'supabase' WHERE storage_provider = 'SUPABASE'"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        "UPDATE files SET storage_provider = 'SUPABASE' WHERE storage_provider = 'supabase'"
    )

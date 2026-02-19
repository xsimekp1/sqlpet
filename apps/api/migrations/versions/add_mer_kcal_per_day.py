"""Add mer_kcal_per_day to animals table

Revision ID: add_mer_kcal_per_day
Revises: add_medical_status_columns
Create Date: 2026-02-18
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "add_mer_kcal_per_day"
down_revision: Union[str, None] = "add_medical_status_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("animals", sa.Column("mer_kcal_per_day", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("animals", "mer_kcal_per_day")

"""Add planned and actual outcome dates to intakes

Revision ID: add_intake_outcome_dates
Revises:
Create Date: 2026-02-16

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_intake_outcome_dates"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "intakes", sa.Column("planned_outcome_date", sa.Date(), nullable=True)
    )
    op.add_column("intakes", sa.Column("actual_outcome_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("intakes", "actual_outcome_date")
    op.drop_column("intakes", "planned_outcome_date")

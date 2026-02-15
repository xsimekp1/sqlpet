"""Remove intake_date from animals table

Revision ID: remove_animal_intake_date
Revises: add_task_inventory_link
Create Date: 2026-02-15

"""

from alembic import op
import sqlalchemy as sa

revision = "remove_animal_intake_date"
down_revision = "add_task_inventory_link"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("animals", "intake_date")


def downgrade():
    op.add_column(
        "animals",
        sa.Column("intake_date", sa.Date(), nullable=True),
    )

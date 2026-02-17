"""Add default_image_url to animals

Revision ID: add_default_image_url
Revises: add_hotel_price_per_day
Create Date: 2026-02-17

"""

from alembic import op
import sqlalchemy as sa

revision = "add_default_image_url"
down_revision = "add_hotel_price_per_day"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "animals",
        sa.Column("default_image_url", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column("animals", "default_image_url")

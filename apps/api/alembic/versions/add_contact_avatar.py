"""Add avatar_url to contacts table

Revision ID: add_contact_avatar
Revises: add_incidents
Create Date: 2026-02-15

"""

from alembic import op
import sqlalchemy as sa

revision = "add_contact_avatar"
down_revision = "add_incidents"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("contacts", sa.Column("avatar_url", sa.Text, nullable=True))


def downgrade():
    op.drop_column("contacts", "avatar_url")

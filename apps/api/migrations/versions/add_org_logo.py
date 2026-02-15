"""Add logo_url to organizations table

Revision ID: add_org_logo
Revises: add_contact_avatar
Create Date: 2026-02-15

"""

from alembic import op
import sqlalchemy as sa

revision = "add_org_logo"
down_revision = "add_contact_avatar"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("organizations", sa.Column("logo_url", sa.Text, nullable=True))


def downgrade():
    op.drop_column("organizations", "logo_url")

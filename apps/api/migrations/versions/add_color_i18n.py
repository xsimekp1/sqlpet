"""Add color_i18n table for color translations

Revision ID: add_color_i18n
Revises: 7127d1fdd44e
Create Date: 2026-02-13

- Create color_i18n table for CS/EN color name translations
- system-wide translations (organization_id IS NULL)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_color_i18n"
down_revision = "7127d1fdd44e"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "color_i18n",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("locale", sa.String(5), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.UniqueConstraint("code", "locale", name="uq_color_i18n_code_locale"),
    )
    op.create_index("idx_color_i18n_code", "color_i18n", ["code"])


def downgrade():
    op.drop_index("idx_color_i18n_code", table_name="color_i18n")
    op.drop_table("color_i18n")

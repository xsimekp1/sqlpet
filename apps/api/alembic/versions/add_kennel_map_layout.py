"""Add map layout columns to kennels table

Revision ID: add_kennel_map_layout
Revises:
- Add map position and size columns for visual kennel layout
- Add map metadata for future features
- Create index for efficient layout queries

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "add_kennel_map_layout"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add map layout columns to kennels table
    op.add_column(
        "kennels", sa.Column("map_x", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column(
        "kennels", sa.Column("map_y", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column(
        "kennels",
        sa.Column("map_w", sa.Integer(), nullable=False, server_default="160"),
    )
    op.add_column(
        "kennels",
        sa.Column("map_h", sa.Integer(), nullable=False, server_default="120"),
    )
    op.add_column("kennels", sa.Column("map_rotation", sa.Integer(), nullable=True))
    op.add_column(
        "kennels",
        sa.Column("map_meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    # Create index for efficient layout queries
    op.create_index(
        "idx_kennels_map_pos",
        "kennels",
        ["organization_id", "zone_id", "map_x", "map_y"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade():
    # Remove index first
    op.drop_index("idx_kennels_map_pos", table_name="kennels")

    # Remove columns
    op.drop_column("kennels", "map_meta")
    op.drop_column("kennels", "map_rotation")
    op.drop_column("kennels", "map_h")
    op.drop_column("kennels", "map_w")
    op.drop_column("kennels", "map_y")
    op.drop_column("kennels", "map_x")

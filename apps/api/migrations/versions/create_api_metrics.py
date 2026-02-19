"""Create api_metrics table

Revision ID: create_api_metrics
Revises: add_medical_status_columns
Create Date: 2026-02-18

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "create_api_metrics"
down_revision = "add_medical_status_columns"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "api_metrics",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.String(36), nullable=True),
        sa.Column("user_id", sa.String(36), nullable=True),
        sa.Column("method", sa.String(10), nullable=False),
        sa.Column("path", sa.String(500), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("db_ms", sa.Integer(), nullable=True),
        sa.Column("query_count", sa.Integer(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_api_metrics_org_id", "api_metrics", ["organization_id"])
    op.create_index("ix_api_metrics_created_at", "api_metrics", ["created_at"])


def downgrade():
    op.drop_table("api_metrics")

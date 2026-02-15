"""Add animal_incidents table

Revision ID: add_incidents
Revises: add_user_shortcuts
Create Date: 2026-02-15

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_incidents"
down_revision = "add_user_shortcuts"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "animal_incidents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("animal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("animals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("incident_type", sa.String(64), nullable=False),  # e.g. 'escape', 'injury', 'illness'
        sa.Column("incident_date", sa.Date, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("resolved", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_incidents_animal_id", "animal_incidents", ["animal_id"])
    op.create_index("ix_incidents_organization_id", "animal_incidents", ["organization_id"])
    op.create_index("ix_incidents_incident_date", "animal_incidents", ["incident_date"])


def downgrade():
    op.drop_index("ix_incidents_incident_date", table_name="animal_incidents")
    op.drop_index("ix_incidents_organization_id", table_name="animal_incidents")
    op.drop_index("ix_incidents_animal_id", table_name="animal_incidents")
    op.drop_table("animal_incidents")

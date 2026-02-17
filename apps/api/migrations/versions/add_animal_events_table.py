"""Add animal_events table

Revision ID: add_animal_events_table
Revises: add_last_walked_at
Create Date: 2026-02-17

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_animal_events_table"
down_revision = "add_last_walked_at"
branch_labels = None
depends_on = None


def upgrade():
    # Create animal_event_type enum
    op.execute("""
        CREATE TYPE animal_event_type AS ENUM (
            'INTAKE', 'KENNEL_MOVE', 'STATUS_CHANGE', 
            'NOTE', 'MEDICAL', 'OUTCOME', 'WALK'
        )
    """)

    # Create animal_events table
    op.create_table(
        "animal_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("animal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "event_type",
            sa.Enum(
                "INTAKE",
                "KENNEL_MOVE",
                "STATUS_CHANGE",
                "NOTE",
                "MEDICAL",
                "OUTCOME",
                "WALK",
                name="animal_event_type",
            ),
            nullable=False,
        ),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("title", sa.Text, nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("payload", postgresql.JSONB, nullable=True),
        sa.Column("related_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("related_kennel_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("related_intake_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("related_outcome_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Create indexes
    op.create_index(
        "ix_animal_events_org_animal", "animal_events", ["organization_id", "animal_id"]
    )
    op.create_index(
        "ix_animal_events_org_type", "animal_events", ["organization_id", "event_type"]
    )
    op.create_index("ix_animal_events_occurred_at", "animal_events", ["occurred_at"])

    # Add foreign keys
    op.create_foreign_key(
        "fk_animal_events_org",
        "animal_events",
        "organizations",
        ["organization_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_animal_events_animal", "animal_events", "animals", ["animal_id"], ["id"]
    )
    op.create_foreign_key(
        "fk_animal_events_user", "animal_events", "users", ["related_user_id"], ["id"]
    )
    op.create_foreign_key(
        "fk_animal_events_kennel",
        "animal_events",
        "kennels",
        ["related_kennel_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_animal_events_intake",
        "animal_events",
        "intakes",
        ["related_intake_id"],
        ["id"],
    )


def downgrade():
    op.drop_table("animal_events")
    op.execute("DROP TYPE animal_event_type")

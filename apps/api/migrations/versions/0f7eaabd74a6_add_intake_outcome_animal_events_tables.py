"""add_intake_outcome_animal_events_tables

Revision ID: 0f7eaabd74a6
Revises: d7e6405d8340
Create Date: 2026-02-11 17:57:53.930647

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0f7eaabd74a6"
down_revision: Union[str, Sequence[str], None] = "d7e6405d8340"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add intake, outcome, and animal_events tables."""

    # Create intake types enum
    op.execute(
        "CREATE TYPE intake_type AS ENUM ('FOUND', 'BORN', 'SURRENDERED', 'TRANSFER_IN', 'OTHER')"
    )

    # Create outcome types enum
    op.execute(
        "CREATE TYPE outcome_type AS ENUM ('ADOPTED', 'FOSTERED', 'TRANSFERRED_OUT', 'ESCAPED', 'DECEASED', 'OTHER')"
    )

    # Create event types enum
    op.execute(
        "CREATE TYPE animal_event_type AS ENUM ('INTAKE', 'KENNEL_MOVE', 'STATUS_CHANGE', 'NOTE', 'MEDICAL', 'OUTCOME')"
    )

    # Create intakes table
    op.create_table(
        "intakes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("animal_id", sa.UUID(), nullable=False),
        sa.Column(
            "intake_type",
            sa.Enum(
                "FOUND",
                "BORN",
                "SURRENDERED",
                "TRANSFER_IN",
                "OTHER",
                name="intake_type",
            ),
            nullable=False,
        ),
        sa.Column("intake_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("found_location_text", sa.Text(), nullable=True),
        sa.Column("found_date", sa.Date(), nullable=True),
        sa.Column("source_org_text", sa.Text(), nullable=True),
        sa.Column("transfer_ref", sa.Text(), nullable=True),
        sa.Column("brought_by_person_id", sa.UUID(), nullable=True),
        sa.Column("hold_until", sa.Date(), nullable=True),
        sa.Column("case_municipality", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["animal_id"],
            ["animals.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_intakes_org_animal",
        "intakes",
        ["organization_id", "animal_id"],
        unique=False,
    )
    op.create_index(
        "ix_intakes_org_datetime",
        "intakes",
        ["organization_id", "intake_datetime"],
        unique=False,
    )

    # Create outcomes table
    op.create_table(
        "outcomes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("animal_id", sa.UUID(), nullable=False),
        sa.Column(
            "outcome_type",
            sa.Enum(
                "ADOPTED",
                "FOSTERED",
                "TRANSFERRED_OUT",
                "ESCAPED",
                "DECEASED",
                "OTHER",
                name="outcome_type",
            ),
            nullable=False,
        ),
        sa.Column("outcome_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("destination_org_text", sa.Text(), nullable=True),
        sa.Column("adopter_person_id", sa.UUID(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["animal_id"],
            ["animals.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_outcomes_org_animal",
        "outcomes",
        ["organization_id", "animal_id"],
        unique=False,
    )
    op.create_index(
        "ix_outcomes_org_datetime",
        "outcomes",
        ["organization_id", "outcome_datetime"],
        unique=False,
    )

    # Create animal_events table
    op.create_table(
        "animal_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("animal_id", sa.UUID(), nullable=False),
        sa.Column(
            "event_type",
            sa.Enum(
                "INTAKE",
                "KENNEL_MOVE",
                "STATUS_CHANGE",
                "NOTE",
                "MEDICAL",
                "OUTCOME",
                name="animal_event_type",
            ),
            nullable=False,
        ),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("related_user_id", sa.UUID(), nullable=True),
        sa.Column("related_kennel_id", sa.UUID(), nullable=True),
        sa.Column("related_intake_id", sa.UUID(), nullable=True),
        sa.Column("related_outcome_id", sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["animal_id"],
            ["animals.id"],
        ),
        sa.ForeignKeyConstraint(
            ["related_user_id"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["related_kennel_id"],
            ["kennels.id"],
        ),
        sa.ForeignKeyConstraint(
            ["related_intake_id"],
            ["intakes.id"],
        ),
        sa.ForeignKeyConstraint(
            ["related_outcome_id"],
            ["outcomes.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_animal_events_org_animal",
        "animal_events",
        ["organization_id", "animal_id"],
        unique=False,
    )
    op.create_index(
        "ix_animal_events_org_type",
        "animal_events",
        ["organization_id", "event_type"],
        unique=False,
    )
    op.create_index(
        "ix_animal_events_org_datetime",
        "animal_events",
        ["organization_id", "occurred_at"],
        unique=False,
    )


def downgrade() -> None:
    """Remove intake, outcome, and animal_events tables."""

    # Drop tables
    op.drop_table("animal_events")
    op.drop_table("outcomes")
    op.drop_table("intakes")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS animal_event_type")
    op.execute("DROP TYPE IF EXISTS outcome_type")
    op.execute("DROP TYPE IF EXISTS intake_type")

"""Add registered animal status

Revision ID: add_registered_animal_status
Revises: remove_animal_intake_date
Create Date: 2026-02-15

"""

from alembic import op

revision = "add_registered_animal_status"
down_revision = "remove_animal_intake_date"
branch_labels = None
depends_on = None


def upgrade():
    # Just add 'registered' to the enum - skip the update for now
    op.execute("ALTER TYPE animal_status_enum ADD VALUE IF NOT EXISTS 'registered'")


def downgrade():
    # No need to remove enum values in downgrade
    pass

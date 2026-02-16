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
    # Add enum value outside of transaction
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE animal_status_enum ADD VALUE IF NOT EXISTS 'registered'")

    # Now update the data
    op.execute("""
        UPDATE animals
        SET status = 'registered'::animal_status_enum
        WHERE status::text = 'intake'
          AND id NOT IN (
            SELECT DISTINCT animal_id FROM intakes
            WHERE deleted_at IS NULL
          )
          AND deleted_at IS NULL
    """)


def downgrade():
    # Cannot remove enum values in PostgreSQL, so just update data
    op.execute("""
        UPDATE animals
        SET status = 'intake'::animal_status_enum
        WHERE status::text = 'registered'
          AND deleted_at IS NULL
    """)

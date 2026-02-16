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
    # The status column is already VARCHAR (not a native PostgreSQL enum),
    # so no DDL change is needed. New animals will default to 'registered'
    # via the SQLAlchemy model default.
    # Update existing animals that have status='intake' but no current_intake_date
    # to 'registered' so they are correctly categorised.
    op.execute("""
        UPDATE animals
        SET status = 'registered'
        WHERE status::text = 'intake'
          AND id NOT IN (
            SELECT DISTINCT animal_id FROM intakes
            WHERE deleted_at IS NULL
          )
          AND deleted_at IS NULL
    """)


def downgrade():
    op.execute("""
        UPDATE animals
        SET status = 'intake'
        WHERE status::text = 'registered'
          AND deleted_at IS NULL
    """)

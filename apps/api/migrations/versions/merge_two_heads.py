"""Merge fix_kennel_stays_cleanup and add_registered_animal_status heads

Revision ID: merge_two_heads
Revises: fix_kennel_stays_cleanup, add_registered_animal_status
Create Date: 2026-02-15
"""
from alembic import op

revision = "merge_two_heads"
down_revision = ("fix_kennel_stays_cleanup", "add_registered_animal_status")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass

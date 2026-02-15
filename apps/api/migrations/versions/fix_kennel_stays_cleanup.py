"""Close orphan kennel stays for animals with no active intake

Revision ID: fix_kennel_stays_cleanup
Revises: add_org_logo
Create Date: 2026-02-15

"""

from alembic import op

revision = "fix_kennel_stays_cleanup"
down_revision = "add_org_logo"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        UPDATE kennel_stays
        SET end_at = NOW()
        WHERE end_at IS NULL
          AND animal_id NOT IN (
              SELECT DISTINCT animal_id FROM intakes WHERE deleted_at IS NULL
          )
        """
    )


def downgrade():
    pass

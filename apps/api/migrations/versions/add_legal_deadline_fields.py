"""Add legal deadline fields to intakes for found animal deadlines

Revision ID: add_legal_deadline_fields
Revises: add_qty_current
Create Date: 2026-02-20

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "add_legal_deadline_fields"
down_revision = "add_qty_current"
branch_labels = None
depends_on = None


def upgrade():
    # Add notice_published_at (date of municipality notice publication)
    op.execute(
        text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'intakes' AND column_name = 'notice_published_at'
            ) THEN
                ALTER TABLE intakes ADD COLUMN notice_published_at DATE;
            END IF;
        END $$;
    """)
    )

    # Add finder_claims_ownership (does finder want to claim ownership)
    op.execute(
        text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'intakes' AND column_name = 'finder_claims_ownership'
            ) THEN
                ALTER TABLE intakes ADD COLUMN finder_claims_ownership BOOLEAN;
            END IF;
        END $$;
    """)
    )

    # Add municipality_irrevocably_transferred (has municipality transferred irrevocably)
    op.execute(
        text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'intakes' AND column_name = 'municipality_irrevocably_transferred'
            ) THEN
                ALTER TABLE intakes ADD COLUMN municipality_irrevocably_transferred BOOLEAN;
            END IF;
        END $$;
    """)
    )


def downgrade():
    op.execute(
        text(
            "ALTER TABLE intakes DROP COLUMN IF EXISTS municipality_irrevocably_transferred"
        )
    )
    op.execute(
        text("ALTER TABLE intakes DROP COLUMN IF EXISTS finder_claims_ownership")
    )
    op.execute(text("ALTER TABLE intakes DROP COLUMN IF EXISTS notice_published_at"))

"""rename_species_rabbit_to_rodent

Revision ID: 1d675e8e5cbd
Revises: b36400f933ef
Create Date: 2026-02-20 17:03:48.920508

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1d675e8e5cbd"
down_revision: Union[str, Sequence[str], None] = "b36400f933ef"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - rename rabbit to rodent in all tables (idempotent)."""
    conn = op.get_bind()

    # Step 1: Add 'rodent' to enum if not exists (idempotent)
    result_rodent = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_enum WHERE enumlabel = 'rodent' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'species_enum')"
        )
    ).fetchone()
    if not result_rodent:
        conn.execute(sa.text("ALTER TYPE species_enum ADD VALUE 'rodent'"))

    # Step 2: Now update the data - only if rabbit exists
    conn.execute(
        sa.text("UPDATE animals SET species = 'rodent' WHERE species = 'rabbit'")
    )
    conn.execute(
        sa.text(
            "UPDATE inventory_items SET target_species = 'rodent' WHERE target_species = 'rabbit'"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE food SET target_species = 'rodent' WHERE target_species = 'rabbit'"
        )
    )

    # Step 3: Remove 'rabbit' from enum - only if 'rabbit' still exists and 'rodent' exists
    result_rabbit = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_enum WHERE enumlabel = 'rabbit' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'species_enum')"
        )
    ).fetchone()

    if result_rabbit and result_rodent:
        # Rename the enum type to remove 'rabbit'
        conn.execute(sa.text("ALTER TYPE species_enum RENAME TO species_enum_old"))
        conn.execute(
            sa.text(
                "CREATE TYPE species_enum AS ENUM ('dog', 'cat', 'rodent', 'bird', 'other')"
            )
        )
        conn.execute(
            sa.text(
                "ALTER TABLE animals ALTER COLUMN species TYPE species_enum USING species::text::species_enum"
            )
        )
        conn.execute(
            sa.text(
                "ALTER TABLE default_animal_images ALTER COLUMN species TYPE species_enum USING species::text::species_enum"
            )
        )
        conn.execute(sa.text("DROP TYPE species_enum_old"))


def downgrade() -> None:
    """Downgrade schema - rename rodent back to rabbit."""
    conn = op.get_bind()

    # Step 1: Add 'rabbit' to enum if not exists
    result_rabbit = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_enum WHERE enumlabel = 'rabbit' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'species_enum')"
        )
    ).fetchone()
    if not result_rabbit:
        conn.execute(sa.text("ALTER TYPE species_enum ADD VALUE 'rabbit'"))

    # Step 2: Update data from 'rodent' to 'rabbit'
    conn.execute(
        sa.text("UPDATE animals SET species = 'rabbit' WHERE species = 'rodent'")
    )
    conn.execute(
        sa.text(
            "UPDATE inventory_items SET target_species = 'rabbit' WHERE target_species = 'rodent'"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE food SET target_species = 'rabbit' WHERE target_species = 'rodent'"
        )
    )

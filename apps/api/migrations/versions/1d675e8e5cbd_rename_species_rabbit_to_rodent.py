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

    # Step 1: Check if 'rodent' already exists
    result_rodent = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_enum WHERE enumlabel = 'rodent' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'species_enum')"
        )
    ).fetchone()

    # Step 1a: Add 'rodent' to enum if not exists and commit
    if not result_rodent:
        conn.execute(sa.text("ALTER TYPE species_enum ADD VALUE 'rodent'"))
        # Commit to make the new enum value available
        conn.execute(sa.text("COMMIT"))
        conn.execute(sa.text("BEGIN"))

    # Step 2: Convert columns to VARCHAR in ALL tables that use species enum
    conn.execute(sa.text("ALTER TABLE animals ALTER COLUMN species TYPE VARCHAR(20)"))
    conn.execute(
        sa.text(
            "ALTER TABLE default_animal_images ALTER COLUMN species TYPE VARCHAR(20)"
        )
    )
    conn.execute(sa.text("ALTER TABLE breeds ALTER COLUMN species TYPE VARCHAR(20)"))

    # Step 3: Update the data from rabbit to rodent in ALL tables
    conn.execute(
        sa.text("UPDATE animals SET species = 'rodent' WHERE species = 'rabbit'")
    )
    conn.execute(
        sa.text("UPDATE default_animal_images SET species = 'rodent' WHERE species = 'rabbit'")
    )
    conn.execute(
        sa.text("UPDATE breeds SET species = 'rodent' WHERE species = 'rabbit'")
    )

    # Step 4: Check if 'rabbit' still exists in enum
    result_rabbit = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_enum WHERE enumlabel = 'rabbit' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'species_enum')"
        )
    ).fetchone()

    # Step 4a: If rabbit exists, recreate enum without it
    if result_rabbit:
        conn.execute(sa.text("ALTER TYPE species_enum RENAME TO species_enum_old"))
        conn.execute(
            sa.text(
                "CREATE TYPE species_enum AS ENUM ('dog', 'cat', 'rodent', 'bird', 'other')"
            )
        )
        # Drop old enum if it exists
        conn.execute(sa.text("DROP TYPE IF EXISTS species_enum_old"))

    # Step 5: Convert back to enum for ALL tables
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
    conn.execute(
        sa.text(
            "ALTER TABLE breeds ALTER COLUMN species TYPE species_enum USING species::text::species_enum"
        )
    )


def downgrade() -> None:
    """Downgrade schema - rename rodent back to rabbit."""
    conn = op.get_bind()

    # Step 1: Add 'rabbit' to enum if not exists and commit
    result_rabbit = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_enum WHERE enumlabel = 'rabbit' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'species_enum')"
        )
    ).fetchone()
    if not result_rabbit:
        conn.execute(sa.text("ALTER TYPE species_enum ADD VALUE 'rabbit'"))
        conn.execute(sa.text("COMMIT"))
        conn.execute(sa.text("BEGIN"))

    # Step 2: Convert to VARCHAR first for ALL tables
    conn.execute(sa.text("ALTER TABLE animals ALTER COLUMN species TYPE VARCHAR(20)"))
    conn.execute(
        sa.text(
            "ALTER TABLE default_animal_images ALTER COLUMN species TYPE VARCHAR(20)"
        )
    )
    conn.execute(sa.text("ALTER TABLE breeds ALTER COLUMN species TYPE VARCHAR(20)"))

    # Step 3: Update data from 'rodent' to 'rabbit' in ALL tables
    conn.execute(
        sa.text("UPDATE animals SET species = 'rabbit' WHERE species = 'rodent'")
    )
    conn.execute(
        sa.text("UPDATE default_animal_images SET species = 'rabbit' WHERE species = 'rodent'")
    )
    conn.execute(
        sa.text("UPDATE breeds SET species = 'rabbit' WHERE species = 'rodent'")
    )

    # Step 4: Check if rodent exists and recreate enum without it
    result_rodent = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_enum WHERE enumlabel = 'rodent' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'species_enum')"
        )
    ).fetchone()

    if result_rodent:
        conn.execute(sa.text("ALTER TYPE species_enum RENAME TO species_enum_old"))
        conn.execute(
            sa.text(
                "CREATE TYPE species_enum AS ENUM ('dog', 'cat', 'rabbit', 'bird', 'other')"
            )
        )
        conn.execute(sa.text("DROP TYPE IF EXISTS species_enum_old"))

    # Step 5: Convert back to enum for ALL tables
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
    conn.execute(
        sa.text(
            "ALTER TABLE breeds ALTER COLUMN species TYPE species_enum USING species::text::species_enum"
        )
    )

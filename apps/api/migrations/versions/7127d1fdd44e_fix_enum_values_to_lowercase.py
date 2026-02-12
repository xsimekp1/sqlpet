"""fix enum values to lowercase

Revision ID: 7127d1fdd44e
Revises: e76d461ff0e5
Create Date: 2026-02-12 22:57:21.406348

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7127d1fdd44e'
down_revision: Union[str, Sequence[str], None] = 'e76d461ff0e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - convert all enum values from UPPERCASE to lowercase."""

    # Species enum: DOG -> dog, CAT -> cat, etc.
    op.execute("ALTER TYPE species_enum RENAME TO species_enum_old")
    op.execute("CREATE TYPE species_enum AS ENUM ('dog', 'cat', 'rabbit', 'bird', 'other')")
    op.execute("""
        ALTER TABLE animals
        ALTER COLUMN species TYPE species_enum
        USING LOWER(species::text)::species_enum
    """)
    op.execute("""
        ALTER TABLE breeds
        ALTER COLUMN species TYPE species_enum
        USING LOWER(species::text)::species_enum
    """)
    op.execute("DROP TYPE species_enum_old")

    # Sex enum: MALE -> male, FEMALE -> female, UNKNOWN -> unknown
    # Drop default before type change
    op.execute("ALTER TABLE animals ALTER COLUMN sex DROP DEFAULT")
    op.execute("ALTER TYPE sex_enum RENAME TO sex_enum_old")
    op.execute("CREATE TYPE sex_enum AS ENUM ('male', 'female', 'unknown')")
    op.execute("""
        ALTER TABLE animals
        ALTER COLUMN sex TYPE sex_enum
        USING LOWER(sex::text)::sex_enum
    """)
    # Restore default with lowercase value
    op.execute("ALTER TABLE animals ALTER COLUMN sex SET DEFAULT 'unknown'")
    op.execute("DROP TYPE sex_enum_old")

    # Animal status enum
    # Drop default before type change
    op.execute("ALTER TABLE animals ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TYPE animal_status_enum RENAME TO animal_status_enum_old")
    op.execute("""
        CREATE TYPE animal_status_enum AS ENUM (
            'intake', 'available', 'reserved', 'adopted', 'fostered',
            'returned', 'deceased', 'transferred', 'hold', 'quarantine',
            'returned_to_owner', 'euthanized', 'escaped'
        )
    """)
    op.execute("""
        ALTER TABLE animals
        ALTER COLUMN status TYPE animal_status_enum
        USING LOWER(status::text)::animal_status_enum
    """)
    # Restore default with lowercase value
    op.execute("ALTER TABLE animals ALTER COLUMN status SET DEFAULT 'intake'")
    op.execute("DROP TYPE animal_status_enum_old")

    # Altered status enum
    # Drop default before type change
    op.execute("ALTER TABLE animals ALTER COLUMN altered_status DROP DEFAULT")
    op.execute("ALTER TYPE altered_status_enum RENAME TO altered_status_enum_old")
    op.execute("CREATE TYPE altered_status_enum AS ENUM ('intact', 'neutered', 'spayed', 'unknown')")
    op.execute("""
        ALTER TABLE animals
        ALTER COLUMN altered_status TYPE altered_status_enum
        USING LOWER(altered_status::text)::altered_status_enum
    """)
    # Restore default with lowercase value
    op.execute("ALTER TABLE animals ALTER COLUMN altered_status SET DEFAULT 'unknown'")
    op.execute("DROP TYPE altered_status_enum_old")


def downgrade() -> None:
    """Downgrade schema - convert back to UPPERCASE (not recommended)."""

    # Altered status enum
    op.execute("ALTER TYPE altered_status_enum RENAME TO altered_status_enum_new")
    op.execute("CREATE TYPE altered_status_enum AS ENUM ('INTACT', 'NEUTERED', 'SPAYED', 'UNKNOWN')")
    op.execute("""
        ALTER TABLE animals
        ALTER COLUMN altered_status TYPE altered_status_enum
        USING UPPER(altered_status::text)::altered_status_enum
    """)
    op.execute("DROP TYPE altered_status_enum_new")

    # Animal status enum
    op.execute("ALTER TYPE animal_status_enum RENAME TO animal_status_enum_new")
    op.execute("""
        CREATE TYPE animal_status_enum AS ENUM (
            'INTAKE', 'AVAILABLE', 'RESERVED', 'ADOPTED', 'FOSTERED',
            'RETURNED', 'DECEASED', 'TRANSFERRED'
        )
    """)
    op.execute("""
        ALTER TABLE animals
        ALTER COLUMN status TYPE animal_status_enum
        USING UPPER(status::text)::animal_status_enum
    """)
    op.execute("DROP TYPE animal_status_enum_new")

    # Sex enum
    op.execute("ALTER TYPE sex_enum RENAME TO sex_enum_new")
    op.execute("CREATE TYPE sex_enum AS ENUM ('MALE', 'FEMALE', 'UNKNOWN')")
    op.execute("""
        ALTER TABLE animals
        ALTER COLUMN sex TYPE sex_enum
        USING UPPER(sex::text)::sex_enum
    """)
    op.execute("DROP TYPE sex_enum_new")

    # Species enum
    op.execute("ALTER TYPE species_enum RENAME TO species_enum_new")
    op.execute("CREATE TYPE species_enum AS ENUM ('DOG', 'CAT', 'RABBIT', 'BIRD', 'OTHER')")
    op.execute("""
        ALTER TABLE animals
        ALTER COLUMN species TYPE species_enum
        USING UPPER(species::text)::species_enum
    """)
    op.execute("""
        ALTER TABLE breeds
        ALTER COLUMN species TYPE species_enum
        USING UPPER(species::text)::species_enum
    """)
    op.execute("DROP TYPE species_enum_new")

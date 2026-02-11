"""fix_animal_enum_values_to_lowercase

Revision ID: 232a6827a49b
Revises: 533a94311006
Create Date: 2026-02-11 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "232a6827a49b"
down_revision: Union[str, Sequence[str], None] = "533a94311006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix animal enum values - convert from ENUM to VARCHAR with lowercase values."""

    # Convert columns from ENUM to VARCHAR and lowercase the values
    # species
    op.execute("ALTER TABLE animals ALTER COLUMN species TYPE VARCHAR USING lower(species::text)")

    # sex
    op.execute("ALTER TABLE animals ALTER COLUMN sex TYPE VARCHAR USING lower(sex::text)")

    # status
    op.execute("ALTER TABLE animals ALTER COLUMN status TYPE VARCHAR USING lower(status::text)")

    # altered_status
    op.execute("ALTER TABLE animals ALTER COLUMN altered_status TYPE VARCHAR USING lower(altered_status::text)")

    # age_group
    op.execute("ALTER TABLE animals ALTER COLUMN age_group TYPE VARCHAR USING lower(age_group::text)")

    # size_estimated
    op.execute("ALTER TABLE animals ALTER COLUMN size_estimated TYPE VARCHAR USING lower(size_estimated::text)")


def downgrade() -> None:
    """Downgrade - convert back to UPPERCASE (not recommended)."""

    # Update species values back to UPPERCASE
    op.execute("UPDATE animals SET species = upper(species::text) WHERE species IS NOT NULL")

    # Update sex values back to UPPERCASE
    op.execute("UPDATE animals SET sex = upper(sex::text) WHERE sex IS NOT NULL")

    # Update status values back to UPPERCASE
    op.execute("UPDATE animals SET status = upper(status::text) WHERE status IS NOT NULL")

    # Update altered_status values back to UPPERCASE
    op.execute("UPDATE animals SET altered_status = upper(altered_status::text) WHERE altered_status IS NOT NULL")

    # Update age_group values back to UPPERCASE
    op.execute("UPDATE animals SET age_group = upper(age_group::text) WHERE age_group IS NOT NULL")

    # Update size_estimated values back to UPPERCASE
    op.execute("UPDATE animals SET size_estimated = upper(size_estimated::text) WHERE size_estimated IS NOT NULL")

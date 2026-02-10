"""003_animal_crud

Revision ID: a3b7c9d1e2f4
Revises: e8d411f4639f
Create Date: 2026-02-10 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a3b7c9d1e2f4'
down_revision: Union[str, Sequence[str], None] = 'e8d411f4639f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # --- New enum types ---
    altered_status_enum = sa.Enum(
        'intact', 'neutered', 'spayed', 'unknown',
        name='altered_status_enum',
    )
    altered_status_enum.create(op.get_bind(), checkfirst=True)

    age_group_enum = sa.Enum(
        'baby', 'young', 'adult', 'senior', 'unknown',
        name='age_group_enum',
    )
    age_group_enum.create(op.get_bind(), checkfirst=True)

    size_estimated_enum = sa.Enum(
        'xs', 's', 'm', 'l', 'xl', 'unknown',
        name='size_estimated_enum',
    )
    size_estimated_enum.create(op.get_bind(), checkfirst=True)

    identifier_type_enum = sa.Enum(
        'microchip', 'tattoo', 'collar_tag', 'other',
        name='identifier_type_enum',
    )
    identifier_type_enum.create(op.get_bind(), checkfirst=True)

    # --- Extend animal_status_enum with new values ---
    op.execute("ALTER TYPE animal_status_enum ADD VALUE IF NOT EXISTS 'hold'")
    op.execute("ALTER TYPE animal_status_enum ADD VALUE IF NOT EXISTS 'quarantine'")
    op.execute("ALTER TYPE animal_status_enum ADD VALUE IF NOT EXISTS 'returned_to_owner'")
    op.execute("ALTER TYPE animal_status_enum ADD VALUE IF NOT EXISTS 'euthanized'")
    op.execute("ALTER TYPE animal_status_enum ADD VALUE IF NOT EXISTS 'escaped'")

    # --- New columns on animals ---
    op.add_column('animals', sa.Column('altered_status', postgresql.ENUM(
        'intact', 'neutered', 'spayed', 'unknown',
        name='altered_status_enum', create_type=False,
    ), server_default='unknown', nullable=False))
    op.add_column('animals', sa.Column('birth_date_estimated', sa.Date(), nullable=True))
    op.add_column('animals', sa.Column('age_group', postgresql.ENUM(
        'baby', 'young', 'adult', 'senior', 'unknown',
        name='age_group_enum', create_type=False,
    ), server_default='unknown', nullable=False))
    op.add_column('animals', sa.Column('color', sa.Text(), nullable=True))
    op.add_column('animals', sa.Column('coat', sa.Text(), nullable=True))
    op.add_column('animals', sa.Column('size_estimated', postgresql.ENUM(
        'xs', 's', 'm', 'l', 'xl', 'unknown',
        name='size_estimated_enum', create_type=False,
    ), server_default='unknown', nullable=False))
    op.add_column('animals', sa.Column('weight_current_kg', sa.Numeric(precision=6, scale=2), nullable=True))
    op.add_column('animals', sa.Column('weight_estimated_kg', sa.Numeric(precision=6, scale=2), nullable=True))
    op.add_column('animals', sa.Column('status_reason', sa.Text(), nullable=True))
    op.add_column('animals', sa.Column('intake_date', sa.Date(), nullable=True))
    op.add_column('animals', sa.Column('outcome_date', sa.Date(), nullable=True))
    op.add_column('animals', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('animals', sa.Column('public_visibility', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('animals', sa.Column('featured', sa.Boolean(), server_default='false', nullable=False))

    # --- Composite index for list queries ---
    op.create_index('ix_animals_org_deleted_created', 'animals', ['organization_id', 'deleted_at', 'created_at'])

    # --- breeds table (global, no org_id) ---
    # Note: species_enum already exists from migration 001
    op.create_table('breeds',
        sa.Column('species', postgresql.ENUM(
            'dog', 'cat', 'rabbit', 'bird', 'other',
            name='species_enum', create_type=False,
        ), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('species', 'name', name='uq_breeds_species_name'),
    )
    op.create_index(op.f('ix_breeds_species'), 'breeds', ['species'], unique=False)

    # --- animal_breeds junction table ---
    op.create_table('animal_breeds',
        sa.Column('animal_id', sa.UUID(), nullable=False),
        sa.Column('breed_id', sa.UUID(), nullable=False),
        sa.Column('percent', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['animal_id'], ['animals.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['breed_id'], ['breeds.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('animal_id', 'breed_id'),
    )

    # --- animal_identifiers table ---
    op.create_table('animal_identifiers',
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('animal_id', sa.UUID(), nullable=False),
        sa.Column('type', postgresql.ENUM(
            'microchip', 'tattoo', 'collar_tag', 'other',
            name='identifier_type_enum', create_type=False,
        ), nullable=False),
        sa.Column('value', sa.String(length=255), nullable=False),
        sa.Column('registry', sa.Text(), nullable=True),
        sa.Column('issued_at', sa.Date(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['animal_id'], ['animals.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_animal_identifiers_animal_id'), 'animal_identifiers', ['animal_id'], unique=False)
    op.create_index(op.f('ix_animal_identifiers_organization_id'), 'animal_identifiers', ['organization_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_animal_identifiers_organization_id'), table_name='animal_identifiers')
    op.drop_index(op.f('ix_animal_identifiers_animal_id'), table_name='animal_identifiers')
    op.drop_table('animal_identifiers')
    op.drop_table('animal_breeds')
    op.drop_index(op.f('ix_breeds_species'), table_name='breeds')
    op.drop_table('breeds')
    op.drop_index('ix_animals_org_deleted_created', table_name='animals')

    op.drop_column('animals', 'featured')
    op.drop_column('animals', 'public_visibility')
    op.drop_column('animals', 'description')
    op.drop_column('animals', 'outcome_date')
    op.drop_column('animals', 'intake_date')
    op.drop_column('animals', 'status_reason')
    op.drop_column('animals', 'weight_estimated_kg')
    op.drop_column('animals', 'weight_current_kg')
    op.drop_column('animals', 'size_estimated')
    op.drop_column('animals', 'coat')
    op.drop_column('animals', 'color')
    op.drop_column('animals', 'age_group')
    op.drop_column('animals', 'birth_date_estimated')
    op.drop_column('animals', 'altered_status')

    sa.Enum(name='identifier_type_enum').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='size_estimated_enum').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='age_group_enum').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='altered_status_enum').drop(op.get_bind(), checkfirst=True)
    # Note: Cannot remove values from animal_status_enum in PG

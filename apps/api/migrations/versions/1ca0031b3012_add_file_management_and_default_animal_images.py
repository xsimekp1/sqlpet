"""add_file_management_and_default_animal_images

Revision ID: 1ca0031b3012
Revises: cdacab9461ba
Create Date: 2026-02-12 10:45:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "1ca0031b3012"
down_revision = "cdacab9461ba"
branch_labels = None
depends_on = None


def upgrade():
    # Create storage_provider enum (if not exists)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE storageprovider AS ENUM ('local', 'supabase');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create files table
    op.create_table(
        "files",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "storage_provider",
            sa.Enum("local", "supabase", name="storageprovider"),
            nullable=False,
        ),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("original_filename", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("uploaded_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_files_organization_id", "files", ["organization_id"], unique=False
    )

    # Create entity_files table
    op.create_table(
        "entity_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("purpose", sa.String(length=50), nullable=True),
        sa.Column("sort_order", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_entity_files_organization_id",
        "entity_files",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_entity_files_entity_type_entity_id",
        "entity_files",
        ["entity_type", "entity_id"],
        unique=False,
    )

    # Create default_animal_images table
    op.create_table(
        "default_animal_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("species", sa.String(length=20), nullable=False),
        sa.Column("breed_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("color_pattern", sa.String(length=100), nullable=True),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("public_url", sa.Text(), nullable=False),
        sa.Column("filename_pattern", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("priority", sa.BigInteger(), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(["breed_id"], ["breeds.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_default_animal_images_species",
        "default_animal_images",
        ["species"],
        unique=False,
    )
    op.create_index(
        "ix_default_animal_images_breed_id",
        "default_animal_images",
        ["breed_id"],
        unique=False,
    )
    op.create_index(
        "ix_default_animal_images_color_pattern",
        "default_animal_images",
        ["color_pattern"],
        unique=False,
    )

    # Create animal_photos table
    op.create_table(
        "animal_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("animal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.BigInteger(), nullable=False),
        sa.Column("uploaded_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["animal_id"], ["animals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_animal_photos_organization_id",
        "animal_photos",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_animal_photos_animal_id", "animal_photos", ["animal_id"], unique=False
    )

    # Update Animal model to use new file system (optional migration)
    # Keep existing primary_photo_url for now, but also link to AnimalPhoto records


def downgrade():
    op.drop_table("animal_photos")
    op.drop_index(
        "ix_default_animal_images_color_pattern", table_name="default_animal_images"
    )
    op.drop_index(
        "ix_default_animal_images_breed_id", table_name="default_animal_images"
    )
    op.drop_index(
        "ix_default_animal_images_species", table_name="default_animal_images"
    )
    op.drop_table("default_animal_images")
    op.drop_index("ix_entity_files_entity_type_entity_id", table_name="entity_files")
    op.drop_index("ix_entity_files_organization_id", table_name="entity_files")
    op.drop_table("entity_files")
    op.drop_index("ix_files_organization_id", table_name="files")
    op.drop_table("files")
    op.execute("DROP TYPE storageprovider")

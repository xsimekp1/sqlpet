"""Add kennels, zones, and stays tables

Revision ID: 004_add_kennels_zones_stays
Revises: a3b7c9d1e2f4
Create Date: 2025-02-11 14:55:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "004_add_kennels_zones_stays"
down_revision: Union[str, None] = "a3b7c9d1e2f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types
    kennel_size_category = sa.Enum(
        "SMALL", "MEDIUM", "LARGE", "XLARGE", name="kennel_size_category"
    )
    kennel_size_category.create(op.get_bind())

    kennel_type = sa.Enum(
        "INDOOR", "OUTDOOR", "ISOLATION", "QUARANTINE", name="kennel_type"
    )
    kennel_type.create(op.get_bind())

    kennel_status = sa.Enum("AVAILABLE", "MAINTENANCE", "CLOSED", name="kennel_status")
    kennel_status.create(op.get_bind())

    # Create zones table
    op.create_table(
        "zones",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_zones_org_deleted_created",
        "zones",
        ["organization_id", "deleted_at", "created_at"],
        unique=False,
    )
    op.create_index(op.f("ix_zones_code"), "zones", ["code"], unique=False)

    # Create kennels table
    op.create_table(
        "kennels",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("zone_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("capacity_rules", sa.JSON(), nullable=True),
        sa.Column("size_category", kennel_size_category, nullable=False),
        sa.Column("status", kennel_status, nullable=False),
        sa.Column("type", kennel_type, nullable=False),
        sa.Column("dimensions", sa.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("primary_photo_path", sa.Text(), nullable=True),
        sa.Column("map_x", sa.Integer(), nullable=False),
        sa.Column("map_y", sa.Integer(), nullable=False),
        sa.Column("map_w", sa.Integer(), nullable=False),
        sa.Column("map_h", sa.Integer(), nullable=False),
        sa.Column("map_rotation", sa.Integer(), nullable=True),
        sa.Column("map_meta", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["zone_id"], ["zones.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_kennels_org_deleted_created",
        "kennels",
        ["organization_id", "deleted_at", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_kennels_zone_code", "kennels", ["zone_id", "code"], unique=False
    )
    op.create_index(op.f("ix_kennels_code"), "kennels", ["code"], unique=False)

    # Create kennel_stays table
    op.create_table(
        "kennel_stays",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kennel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("animal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "start_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reason", sa.String(length=64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("moved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["animal_id"], ["animals.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["kennel_id"], ["kennels.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["moved_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_kennel_stays_org_active",
        "kennel_stays",
        ["organization_id", "end_at"],
        unique=False,
    )
    op.create_index(
        "ix_kennel_stays_kennel_active",
        "kennel_stays",
        ["kennel_id", "end_at"],
        unique=False,
    )
    op.create_index(
        "ix_kennel_stays_animal_active",
        "kennel_stays",
        ["animal_id", "end_at"],
        unique=False,
    )

    # Create kennel_photos table
    op.create_table(
        "kennel_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kennel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["kennel_id"], ["kennels.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_kennel_photos_org_kennel",
        "kennel_photos",
        ["organization_id", "kennel_id"],
        unique=False,
    )
    op.create_index(
        "ix_kennel_photos_primary",
        "kennel_photos",
        ["kennel_id", "is_primary"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("kennel_photos")
    op.drop_table("kennel_stays")
    op.drop_table("kennels")
    op.drop_table("zones")

    # Drop enum types
    sa.Enum(name="kennel_size_category").drop(op.get_bind())
    sa.Enum(name="kennel_type").drop(op.get_bind())
    sa.Enum(name="kennel_status").drop(op.get_bind())

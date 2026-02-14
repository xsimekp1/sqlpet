"""Add BCS field to animals and animal_bcs_logs table; add expected_litter_date

Revision ID: add_bcs
Revises: add_inventory_food_fields
- Add bcs INTEGER (nullable, check 1-9) to animals table
- Add expected_litter_date DATE (nullable) to animals table
- Create animal_bcs_logs table (mirrors animal_weight_logs pattern)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = "add_bcs"
down_revision = "add_inventory_food_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "animals",
        sa.Column("bcs", sa.Integer(), nullable=True),
    )
    op.create_check_constraint("ck_animals_bcs_range", "animals", "bcs >= 1 AND bcs <= 9")
    op.add_column(
        "animals",
        sa.Column("expected_litter_date", sa.Date(), nullable=True),
    )

    op.create_table(
        "animal_bcs_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("animal_id", UUID(as_uuid=True), sa.ForeignKey("animals.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("bcs", sa.Integer(), nullable=False),
        sa.Column("measured_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("stay_id", UUID(as_uuid=True), sa.ForeignKey("kennel_stays.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recorded_by_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("bcs >= 1 AND bcs <= 9", name="ck_animal_bcs_logs_bcs_range"),
    )


def downgrade():
    op.drop_table("animal_bcs_logs")
    op.drop_column("animals", "expected_litter_date")
    op.drop_constraint("ck_animals_bcs_range", "animals", type_="check")
    op.drop_column("animals", "bcs")

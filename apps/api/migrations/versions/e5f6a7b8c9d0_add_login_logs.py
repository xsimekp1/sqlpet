"""add_login_logs

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-02-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'login_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'user_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='SET NULL'),
            nullable=True,
        ),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('ip', sa.String(50), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('failure_reason', sa.String(50), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
    )
    op.create_index('ix_login_logs_user_id', 'login_logs', ['user_id'])
    op.create_index('ix_login_logs_email', 'login_logs', ['email'])
    op.create_index('ix_login_logs_created_at', 'login_logs', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_login_logs_created_at', table_name='login_logs')
    op.drop_index('ix_login_logs_email', table_name='login_logs')
    op.drop_index('ix_login_logs_user_id', table_name='login_logs')
    op.drop_table('login_logs')

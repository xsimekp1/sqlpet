"""add_outreach_campaigns_and_emails

Revision ID: f420bb74450f
Revises: 5e8ada7ee656
Create Date: 2026-03-12 23:29:56.271232

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f420bb74450f'
down_revision: Union[str, Sequence[str], None] = '5e8ada7ee656'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add email column to registered_shelters (needed for outreach)
    op.add_column('registered_shelters', sa.Column('email', sa.String(255), nullable=True))
    op.create_index('ix_registered_shelters_email', 'registered_shelters', ['email'])

    op.create_table(
        'outreach_campaigns',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('subject_template', sa.Text(), nullable=False),
        sa.Column('body_template', sa.Text(), nullable=True),
        sa.Column('from_email', sa.String(255), nullable=False, server_default='info@pets-log.com'),
        sa.Column('reply_to', sa.String(255), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='draft'),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('total_targets', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sent_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('replied_count', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'outreach_emails',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('campaign_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('shelter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('generated_subject', sa.Text(), nullable=True),
        sa.Column('generated_body', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resend_message_id', sa.String(255), nullable=True),
        sa.Column('replied_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reply_subject', sa.Text(), nullable=True),
        sa.Column('reply_content', sa.Text(), nullable=True),
        sa.Column('reply_from', sa.String(255), nullable=True),
        sa.Column('approved_by_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('generation_attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('bounced_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['campaign_id'], ['outreach_campaigns.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['shelter_id'], ['registered_shelters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_outreach_emails_campaign_id', 'outreach_emails', ['campaign_id'])
    op.create_index('ix_outreach_emails_shelter_id', 'outreach_emails', ['shelter_id'])
    op.create_index('ix_outreach_emails_status', 'outreach_emails', ['status'])


def downgrade() -> None:
    op.drop_index('ix_outreach_emails_status', table_name='outreach_emails')
    op.drop_index('ix_outreach_emails_shelter_id', table_name='outreach_emails')
    op.drop_index('ix_outreach_emails_campaign_id', table_name='outreach_emails')
    op.drop_table('outreach_emails')
    op.drop_table('outreach_campaigns')
    op.drop_index('ix_registered_shelters_email', table_name='registered_shelters')
    op.drop_column('registered_shelters', 'email')

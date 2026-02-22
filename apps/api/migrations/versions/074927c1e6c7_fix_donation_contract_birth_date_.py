"""fix_donation_contract_birth_date_placeholder

Revision ID: 074927c1e6c7
Revises: 505e4d0a7ae8
Create Date: 2026-02-22 10:34:32.709484

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '074927c1e6c7'
down_revision: Union[str, Sequence[str], None] = '505e4d0a7ae8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix donation contract template: replace {{animal.age}} with {{animal.birth_date}}."""
    op.execute("""
        UPDATE document_templates
        SET content_html = REPLACE(
            content_html,
            '<strong>Přibližný datum narození:</strong> {{animal.age}}',
            '<strong>Přibližný datum narození:</strong> {{animal.birth_date}}'
        )
        WHERE code = 'donation_contract_dog'
    """)


def downgrade() -> None:
    """Revert donation contract template birth date placeholder."""
    op.execute("""
        UPDATE document_templates
        SET content_html = REPLACE(
            content_html,
            '<strong>Přibližný datum narození:</strong> {{animal.birth_date}}',
            '<strong>Přibližný datum narození:</strong> {{animal.age}}'
        )
        WHERE code = 'donation_contract_dog'
    """)

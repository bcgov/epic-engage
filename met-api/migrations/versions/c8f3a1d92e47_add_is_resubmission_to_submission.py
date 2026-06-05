"""add_is_resubmission_to_submission

Revision ID: c8f3a1d92e47
Revises: b4e7a2c91f03
Create Date: 2026-06-01 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c8f3a1d92e47'
down_revision = 'b4e7a2c91f03'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('submission', sa.Column('is_resubmission', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('submission', 'is_resubmission')

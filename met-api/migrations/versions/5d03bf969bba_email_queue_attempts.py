"""add send attempt count to email_queue

Revision ID: 5d03bf969bba
Revises: 3f6b2d8e9a41
Create Date: 2026-11-18 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '5d03bf969bba'
down_revision = '3f6b2d8e9a41'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('email_queue', sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    op.drop_column('email_queue', 'attempts')

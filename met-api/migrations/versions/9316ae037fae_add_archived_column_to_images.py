"""add archived column to images

Revision ID: 9316ae037fae
Revises: c5ee420f661a
Create Date: 2025-10-21 20:14:57.361956

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9316ae037fae'
down_revision = 'c5ee420f661a'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('image_info', sa.Column('archived', sa.Boolean(), default=False))
    op.execute("UPDATE image_info SET archived = FALSE")


def downgrade():
    op.drop_column('image_info', 'archived')

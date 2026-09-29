"""add public/proponent comment export settings to report_setting

Revision ID: 3f6b2d8e9a41
Revises: e5d18c740b39
Create Date: 2026-09-29 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '3f6b2d8e9a41'
down_revision = 'e5d18c740b39'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('report_setting', sa.Column('export_display', sa.Boolean(), nullable=False,
                                              server_default=sa.true()))
    op.add_column('report_setting', sa.Column('export_description', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('report_setting', 'export_description')
    op.drop_column('report_setting', 'export_display')

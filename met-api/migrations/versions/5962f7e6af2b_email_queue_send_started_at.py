"""add send start time to email_queue

Revision ID: 5962f7e6af2b
Revises: 5d03bf969bba
Create Date: 2026-11-18 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '5962f7e6af2b'
down_revision = '5d03bf969bba'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('email_queue', sa.Column('send_started_at', sa.DateTime(), nullable=True))
    # Rows already PROCESSING may have been delivered, so they count as started and are never requeued.
    op.execute("UPDATE email_queue SET send_started_at = coalesce(updated_date, created_date) "
               "WHERE notification_status = 'PROCESSING'")


def downgrade():
    op.drop_column('email_queue', 'send_started_at')

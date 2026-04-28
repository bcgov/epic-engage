"""add engagement_id to email_verification

Revision ID: a7c3e9f12b48
Revises: 60c4f3c1aabf
Create Date: 2026-04-28 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a7c3e9f12b48'
down_revision = '60c4f3c1aabf'
branch_labels = None
depends_on = None


def upgrade():
    # Add 'Unsubscribe' to the emailverificationtype enum
    op.execute(sa.text("ALTER TYPE emailverificationtype ADD VALUE 'Unsubscribe'"))

    # Add engagement_id column for tracking which engagement the token is for
    op.add_column('email_verification', sa.Column('engagement_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'email_verification_engagement_id_fkey',
        'email_verification',
        'engagement',
        ['engagement_id'],
        ['id']
    )


def downgrade():
    op.drop_constraint('email_verification_engagement_id_fkey', 'email_verification', type_='foreignkey')
    op.drop_column('email_verification', 'engagement_id')
    # Note: PostgreSQL enum values cannot be easily removed, so 'Unsubscribe' remains in the type.
    # This is safe as unused enum values don't affect functionality.

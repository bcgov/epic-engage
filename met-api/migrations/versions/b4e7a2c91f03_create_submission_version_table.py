"""create_submission_version_table

Revision ID: b4e7a2c91f03
Revises: a7c3e9f12b48
Create Date: 2026-05-20 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b4e7a2c91f03'
down_revision = 'a7c3e9f12b48'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('submission_version',
        sa.Column('created_date', sa.DateTime(), nullable=False),
        sa.Column('updated_date', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('submission_id', sa.Integer(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('comment_json', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
        sa.Column('comment_status_id', sa.Integer(), nullable=True),
        sa.Column('reviewed_by', sa.String(length=50), nullable=True),
        sa.Column('review_date', sa.DateTime(), nullable=True),
        sa.Column('has_personal_info', sa.Boolean(), nullable=True),
        sa.Column('has_profanity', sa.Boolean(), nullable=True),
        sa.Column('has_threat', sa.Boolean(), nullable=True),
        sa.Column('rejected_reason_other', sa.String(length=500), nullable=True),
        sa.Column('notify_email', sa.Boolean(), nullable=True),
        sa.Column('staff_note_json', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
        sa.Column('submission_json', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
        sa.ForeignKeyConstraint(['comment_status_id'], ['comment_status.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['submission_id'], ['submission.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_submission_version_submission_id', 'submission_version', ['submission_id'])


def downgrade():
    op.drop_index('ix_submission_version_submission_id', table_name='submission_version')
    op.drop_table('submission_version')

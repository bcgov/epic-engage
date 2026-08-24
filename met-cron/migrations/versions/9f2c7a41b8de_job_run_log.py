"""job_run_log

Durable log of met-cron scheduled job runs, so job history survives a server restart.

Revision ID: 9f2c7a41b8de
Revises: 05e82fada6fe
Create Date: 2026-08-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9f2c7a41b8de'
down_revision = '05e82fada6fe'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('job_run_log',
                    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
                    sa.Column('job_name', sa.String(length=100), nullable=False),
                    sa.Column('started_at', sa.DateTime(), nullable=False),
                    sa.Column('finished_at', sa.DateTime(), nullable=True),
                    sa.Column('duration_seconds', sa.Float(), nullable=True),
                    sa.Column('success', sa.Boolean(), nullable=True),
                    sa.Column('error_type', sa.String(length=200), nullable=True),
                    sa.Column('error_detail', sa.Text(), nullable=True),
                    sa.PrimaryKeyConstraint('id')
                    )
    op.create_index(op.f('ix_job_run_log_job_name'), 'job_run_log', ['job_name'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_job_run_log_job_name'), table_name='job_run_log')
    op.drop_table('job_run_log')

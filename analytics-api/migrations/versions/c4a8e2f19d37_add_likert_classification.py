"""add classification to available_response_option

A Likert value's place on its scale (neg3..pos3, neutral, or notSure), as the survey author set it
in the builder. Null for every other question type and for Likert values saved before
classifications existed; the dashboard treats those as the legacy fixed scale.

Revision ID: c4a8e2f19d37
Revises: b3e91c7d2f45
Create Date: 2026-09-17 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = 'c4a8e2f19d37'
down_revision = 'b3e91c7d2f45'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('available_response_option', sa.Column('classification', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('available_response_option', 'classification')

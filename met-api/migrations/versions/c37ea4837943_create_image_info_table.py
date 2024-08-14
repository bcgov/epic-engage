"""create image info table

Revision ID: c37ea4837943
Revises: a3e6dae331ab
Create Date: 2024-08-01 15:21:53.966495

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c37ea4837943'
down_revision = 'a3e6dae331ab'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('image_info', 
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('unique_name', sa.String()),
    sa.Column('display_name', sa.String()),
    sa.Column('date_uploaded', sa.DateTime()),
    sa.Column('tenant_id', sa.Integer(), nullable=True),
    sa.Column('created_date', sa.DateTime()),
    sa.Column('updated_date', sa.DateTime()),
    sa.Column('created_by', sa.String(length=50), nullable=True),
    sa.Column('updated_by', sa.String(length=50), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenant.id'], ondelete='SET NULL'),
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('image_info')
    # ### end Alembic commands ###
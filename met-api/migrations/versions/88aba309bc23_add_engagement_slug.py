""" Add engagement slug

Revision ID: 88aba309bc23
Revises: 779d9125c8cb
Create Date: 2023-06-20 15:35:49.824000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '88aba309bc23'
down_revision = '779d9125c8cb'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('engagement_slug',
    sa.Column('created_date', sa.DateTime(), nullable=False),
    sa.Column('updated_date', sa.DateTime(), nullable=True),
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('engagement_id', sa.Integer(), nullable=False),
    sa.Column('slug', sa.String(length=200), nullable=False),
    sa.Column('created_by', sa.String(length=50), nullable=True),
    sa.Column('updated_by', sa.String(length=50), nullable=True),
    sa.ForeignKeyConstraint(['engagement_id'], ['engagement.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('engagement_id'),
    sa.UniqueConstraint('slug')
    )
    op.create_index('idx_slug', 'engagement_slug', ['slug'], unique=False)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index('idx_slug', table_name='engagement_slug')
    op.drop_table('engagement_slug')
    # ### end Alembic commands ###
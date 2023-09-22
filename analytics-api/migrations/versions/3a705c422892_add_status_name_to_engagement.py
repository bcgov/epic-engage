"""add_status_name_to_engagement

Revision ID: 3a705c422892
Revises: 88c01f327bed
Create Date: 2023-09-19 16:48:05.480027

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3a705c422892'
down_revision = '88c01f327bed'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('engagement', sa.Column('status_name', sa.String(length=50), nullable=True))
    op.alter_column('request_type_option', 'key', type_=sa.Text())
    op.alter_column('request_type_option', 'label', type_=sa.Text())
    op.alter_column('request_type_option', 'request_id', type_=sa.Text())
    op.alter_column('response_type_option', 'request_key', type_=sa.Text())
    op.alter_column('response_type_option', 'request_id', type_=sa.Text())
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('engagement', 'status_name')
    op.alter_column('request_type_option', 'key', type_=sa.String())
    op.alter_column('request_type_option', 'label', type_=sa.String())
    op.alter_column('request_type_option', 'request_id', type_=sa.String())
    op.alter_column('response_type_option', 'request_key', type_=sa.String())
    op.alter_column('response_type_option', 'request_id', type_=sa.String())
    # ### end Alembic commands ###
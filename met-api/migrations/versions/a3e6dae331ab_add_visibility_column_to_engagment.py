"""Add visibility column to engagment

Revision ID: a3e6dae331ab
Revises: 9a93fda677eb
Create Date: 2024-05-28 08:26:11.155679

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a3e6dae331ab'
down_revision = '9a93fda677eb'
branch_labels = None
depends_on = None

def upgrade():
    # Create the engagement_visibility table
    engagement_visiblity_table = op.create_table(
        'engagement_visibility',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('visibility_name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=100), nullable=False),
        sa.Column('created_date', sa.TIMESTAMP(timezone=False), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_date', sa.TIMESTAMP(timezone=False), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    # Insert the initial data into the engagement_visibility table
    op.bulk_insert(
        engagement_visiblity_table,
        [
            {'id': 1, 'visibility_name': 'Public', 'description': 'Visible to all users'},
            {'id': 2, 'visibility_name': 'Slug', 'description': 'Accessible to users with the direct link'},
            {'id': 3, 'visibility_name': 'AuthToken', 'description': 'Visible to authenticated users'}
        ]
    )
    # Add the visibility column to the engagement table
    op.add_column('engagement', sa.Column('visibility', sa.Integer(), nullable=False, server_default='1'))
    op.create_foreign_key("engagement_visibility_fkey", 'engagement', 'engagement_visibility', ['visibility'], ['id'])
    # Update the visibility column based on the is_internal column
    op.execute("""
        UPDATE engagement e
        SET visibility = ev.id
        FROM engagement_visibility ev
        WHERE (e.is_internal AND ev.visibility_name = 'AuthToken')
           OR (NOT e.is_internal AND ev.visibility_name = 'Public')
    """)
    op.drop_column('engagement', 'is_internal')


def downgrade():
    # Add the is_internal column to the engagement table
    op.add_column('engagement', sa.Column('is_internal', sa.BOOLEAN(), nullable=False, server_default='0'))
    # Populate the is_internal column based on the visibility column
    op.execute("""
        UPDATE engagement e
        SET is_internal = (e.visibility = (SELECT id FROM engagement_visibility WHERE visibility_name = 'AuthToken'))
    """)
    # Drop the foreign key constraint on the visibility column
    op.drop_constraint("engagement_visibility_fkey", 'engagement', type_='foreignkey')
    op.drop_column('engagement', 'visibility')
    op.drop_table('engagement_visibility')
"""create threat contacts table

Revision ID: 60c4f3c1aabf
Revises: 9316ae037fae
Create Date: 2025-11-13 14:23:15.502493

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '60c4f3c1aabf'
down_revision = '9316ae037fae'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('threat_contact',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('first_name', sa.String(length=50), nullable=True),
        sa.Column('last_name', sa.String(length=50), nullable=True),
        sa.Column('email', sa.String(length=50), nullable=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('created_date', sa.DateTime(), nullable=False),
        sa.Column('updated_date', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenant.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    connection = op.get_bind()
    result = connection.execute(
        sa.text("SELECT id FROM tenant WHERE short_name = :short_name"),
        {"short_name": "EAO"}
    )
    tenant_id = result.scalar()

    # Creating default threat contact
    connection.execute(
        sa.text(
            "INSERT INTO threat_contact (first_name, last_name, email, tenant_id, created_date, updated_date) "
            "VALUES (:first_name, :last_name, :email, :tenant_id, now(), now())"
        ),
        {
            "first_name": "Sarah",
            "last_name": "Plank",
            "email": "sarah.plank@gov.bc.ca",
            "tenant_id": tenant_id
        }
    )

    result = connection.execute(
        sa.text("SELECT id FROM threat_contact WHERE email = :email"),
        {"email": "sarah.plank@gov.bc.ca"}
    )
    sarah_id = result.scalar()

    connection.execute(
        sa.text(
            "INSERT INTO settings (setting_key, setting_value, setting_value_type, tenant_id, created_date) "
            "VALUES (:key, :value, :type, :tenant, now())"
        ),
        {
            "key": "threat_contact",
            "value": str(sarah_id),
            "type": "integer",
            "tenant": tenant_id,
        }
    )


def downgrade():
    op.drop_table('threat_contact')

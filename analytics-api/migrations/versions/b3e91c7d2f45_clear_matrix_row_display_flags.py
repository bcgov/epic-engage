"""clear the display flag on matrix sub-question rows

A matrix (simplesurvey/simpleranking) question carries one report setting, held against the
parent component - met-api's report settings no longer keep a row per matrix row, so nothing
writes a display flag to these sub-question rows any more. A flag left over from when they had
their own setting would keep hiding that row from the public report with no way for staff to
switch it back on, so the leftovers are cleared and the parent's flag governs the whole matrix.

Revision ID: b3e91c7d2f45
Revises: 9f2c7a41b8de
Create Date: 2026-08-31 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = 'b3e91c7d2f45'
down_revision = '9f2c7a41b8de'
branch_labels = None
depends_on = None


def upgrade():
    # A sub-question row is one whose request_id is its parent's plus a '-' suffix.
    op.get_bind().execute(sa.text(
        "UPDATE request_type_option child SET display = NULL "
        "WHERE child.type IN ('simplesurvey', 'simpleranking') "
        "AND child.display IS NOT NULL "
        "AND EXISTS (SELECT 1 FROM request_type_option parent "
        "            WHERE parent.survey_id = child.survey_id "
        "            AND parent.type = child.type "
        "            AND child.request_id LIKE parent.request_id || '-%')"
    ))


def downgrade():
    # The flags cleared here were already dead - nothing writes them - so there is nothing to
    # put back.
    pass

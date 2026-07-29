"""invalidate_survey_etl_runcycles

Invalidates all successful survey ETL run cycles so the next ETL run
re-extracts every survey from the MET database. The survey ETL now writes
a parent request_type_option row for Likert (simplesurvey) and Ranking
(simpleranking) questions (ENGAGE-183), which the dashboard uses to group
sub-question results. Re-running the survey load backfills these parent
rows for surveys created before that change; existing rows are deactivated
and responses are remapped to the new active survey rows by the ETL itself.

Revision ID: 96878b3a07fd
Revises: 00e8d4134dbe
Create Date: 2026-07-08

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '96878b3a07fd'
down_revision = '00e8d4134dbe'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "UPDATE etl_runcycle "
        "SET success = false "
        "WHERE packagename = 'survey' AND success = true"
    )


def downgrade():
    pass

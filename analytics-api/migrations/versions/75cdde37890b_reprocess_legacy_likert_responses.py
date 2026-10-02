"""reprocess legacy likert responses and replay report settings

Before the ETL fix of 2023-11-23 (#24), every answer to a Likert (simplesurvey) question was saved
under the parent question's key, e.g. `simplesurvey1`, instead of the sub-question's key,
`simplesurvey1-<row>`. Which row each answer belonged to was lost, and the dashboard, which counts
answers per sub-question, shows those Likert questions with no results.

The submission ETL never revisits old submissions, so this queues a one-off `likert_reprocess`
run cycle. met-etl picks it up, rebuilds the Likert responses of every affected survey from the
original submissions, which still carry the per-row answers, and marks it successful.

It also replays every report setting. When the survey ETL loads a changed survey it creates a new
version whose questions carry no display flag, and the dashboard treats a missing flag as visible;
the report setting ETL only re-applies settings that changed, so questions staff hid were being
served publicly. Most surveys were re-versioned by the replay in 96878b3a07fd, and the Likert
classification migration in met-api re-versions more. Marking the report setting run cycles
unsuccessful makes the next ETL run, which loads surveys before settings, re-apply every flag.

Revision ID: 75cdde37890b
Revises: c4a8e2f19d37
Create Date: 2026-10-01 12:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '75cdde37890b'
down_revision = 'c4a8e2f19d37'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "INSERT INTO etl_runcycle (id, packagename, startdatetime, enddatetime, description, success) "
        "SELECT COALESCE(MAX(id), 0) + 1, 'likert_reprocess', now(), NULL, "
        "'queued: rebuild likert responses saved under the parent question key', false "
        "FROM etl_runcycle"
    )
    op.execute(
        "UPDATE etl_runcycle "
        "SET success = false "
        "WHERE packagename = 'report_setting' AND success = true"
    )


def downgrade():
    op.execute("DELETE FROM etl_runcycle WHERE packagename = 'likert_reprocess' AND success = false")

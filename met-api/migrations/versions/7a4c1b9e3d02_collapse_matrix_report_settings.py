"""collapse matrix report settings into one row per component

A matrix (simplesurvey) question used to get one report setting per row, so staff saw the same
question repeated once per statement on the report settings page - each with its own visibility
toggle and, since descriptions were added, its own description. The dashboard draws a matrix as a
single chart, so those rows now collapse into one setting for the whole component, the way a
ranking's statements always have.

The collapsed row keeps the component's own key/id, is hidden only if every row was hidden, and
takes the first description staff wrote on any of its rows.

Revision ID: 7a4c1b9e3d02
Revises: 538dd25f2a13
Create Date: 2026-08-31 10:00:00.000000

"""
from datetime import datetime

import sqlalchemy as sa
from alembic import op

from met_api.utils.form_components import flatten_components


# revision identifiers, used by Alembic.
revision = '7a4c1b9e3d02'
down_revision = '538dd25f2a13'
branch_labels = None
depends_on = None

MATRIX_TYPE = 'simplesurvey'


def _matrix_components(form_json):
    """Return every matrix component of a form, however deeply the builder nested it."""
    return [component for component in flatten_components(form_json or {})
            if component.get('type') == MATRIX_TYPE and component.get('key')]


def _surveys_with_matrix_settings(conn):
    """Return the surveys whose report settings still hold per-row matrix rows."""
    return conn.execute(sa.text(
        'SELECT DISTINCT s.id, s.form_json FROM survey s '
        'JOIN report_setting rs ON rs.survey_id = s.id '
        'WHERE rs.question_type = :matrix_type'
    ), {'matrix_type': MATRIX_TYPE}).fetchall()


def upgrade():
    conn = op.get_bind()
    for survey_id, form_json in _surveys_with_matrix_settings(conn):
        for component in _matrix_components(form_json):
            row_keys = [f"{component['key']}-{question['value']}"
                        for question in component.get('questions', []) or []
                        if question.get('value')]
            if not row_keys:
                continue

            rows = conn.execute(sa.text(
                'SELECT display, description FROM report_setting '
                'WHERE survey_id = :survey_id AND question_key IN :row_keys'
            ).bindparams(sa.bindparam('row_keys', expanding=True)),
                {'survey_id': survey_id, 'row_keys': row_keys}).fetchall()
            if not rows:
                continue

            # Hiding every row was the only way to keep a matrix out of the report, so that is
            # what the single toggle inherits; a partly hidden matrix stays in the report.
            display = any(row.display is not False for row in rows)
            description = next((row.description for row in rows if row.description), None)

            conn.execute(sa.text(
                'DELETE FROM report_setting '
                'WHERE survey_id = :survey_id AND question_key IN :row_keys'
            ).bindparams(sa.bindparam('row_keys', expanding=True)),
                {'survey_id': survey_id, 'row_keys': row_keys})

            existing = conn.execute(sa.text(
                'SELECT id FROM report_setting WHERE survey_id = :survey_id AND question_key = :key'
            ), {'survey_id': survey_id, 'key': component['key']}).fetchone()
            if existing:
                continue

            conn.execute(sa.text(
                'INSERT INTO report_setting '
                '(survey_id, question_id, question_key, question_type, question, display, '
                'description, created_date, updated_date) '
                'VALUES (:survey_id, :question_id, :question_key, :question_type, :question, '
                ':display, :description, :now, :now)'
            ), {
                'survey_id': survey_id,
                'question_id': component.get('id'),
                'question_key': component['key'],
                'question_type': MATRIX_TYPE,
                'question': component.get('label'),
                'display': display,
                'description': description,
                'now': datetime.utcnow(),
            })


def downgrade():
    conn = op.get_bind()
    for survey_id, form_json in _surveys_with_matrix_settings(conn):
        for component in _matrix_components(form_json):
            questions = [question for question in component.get('questions', []) or []
                         if question.get('value')]
            if not questions:
                continue

            collapsed = conn.execute(sa.text(
                'SELECT display, description FROM report_setting '
                'WHERE survey_id = :survey_id AND question_key = :key'
            ), {'survey_id': survey_id, 'key': component['key']}).fetchone()
            if not collapsed:
                continue

            conn.execute(sa.text(
                'DELETE FROM report_setting WHERE survey_id = :survey_id AND question_key = :key'
            ), {'survey_id': survey_id, 'key': component['key']})

            # The rows shared one toggle and one description while collapsed, so each one is
            # restored carrying what the component held.
            for question in questions:
                conn.execute(sa.text(
                    'INSERT INTO report_setting '
                    '(survey_id, question_id, question_key, question_type, question, display, '
                    'description, created_date, updated_date) '
                    'VALUES (:survey_id, :question_id, :question_key, :question_type, :question, '
                    ':display, :description, :now, :now)'
                ), {
                    'survey_id': survey_id,
                    'question_id': f"{component.get('id')}-{question['value']}",
                    'question_key': f"{component['key']}-{question['value']}",
                    'question_type': MATRIX_TYPE,
                    'question': question.get('label'),
                    'display': collapsed.display,
                    'description': collapsed.description,
                    'now': datetime.utcnow(),
                })

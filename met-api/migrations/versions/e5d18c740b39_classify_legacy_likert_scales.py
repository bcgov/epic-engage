"""classify existing Likert questions by the shape of their scale

Likert questions built before the builder could classify its values carry no classification at
all, so the dashboard falls back to guessing one from each value's position. That guess is wrong
for most of the questions in the database: the commonest legacy scale is four ranked points
followed by a "Not sure" escape hatch, and a positional guess hands that escape hatch the most
positive rank - putting it at the end of the diverging axis, where it reads as the strongest
possible agreement.

Revision ID: e5d18c740b39
Revises: 7a4c1b9e3d02
Create Date: 2026-09-22 10:00:00.000000

"""
import re
from copy import deepcopy
from datetime import datetime

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from met_api.utils.form_components import flatten_components


# revision identifiers, used by Alembic.
revision = 'e5d18c740b39'
down_revision = '7a4c1b9e3d02'
branch_labels = None
depends_on = None

LIKERT_TYPE = 'simplesurvey'
NOT_SURE = 'notSure'

# The ranked points, by how many of them a scale has - an escape hatch is taken off the end
# before counting. A length that is not here is left alone rather than guessed at; six or more
# ranked points cannot be expressed at all, since only pos1..pos3 exist.
RANKED_SCALES = {
    4: ['neg1', 'neutral', 'pos1', 'pos2'],
    5: ['neg2', 'neg1', 'neutral', 'pos1', 'pos2'],
}

# The out-of-scale answer, written several ways over the years. It is only ever recognised as the
# last value of a scale: one in any other position means the order is not what this assumes.
ESCAPE_HATCH_PATTERN = re.compile(r'not\s+sure|not\s+applicable|n/a', re.IGNORECASE)

# Every scale this migration writes, with and without the escape hatch, so the downgrade can
# recognise its own work.
MIGRATED_SCALES = ([list(scale) for scale in RANKED_SCALES.values()] +
                   [scale + [NOT_SURE] for scale in RANKED_SCALES.values()])


def _likert_values(form_json):
    """Yield the values of every Likert question in a form."""
    for component in flatten_components(form_json):
        if component.get('type') != LIKERT_TYPE:
            continue
        values = component.get('values') or []
        if not all(isinstance(value, dict) for value in values):
            continue
        yield values


def _is_escape_hatch(value):
    return bool(ESCAPE_HATCH_PATTERN.search(value.get('label') or ''))


def _scale_for(values):
    """Return the classifications this scale's shape calls for, or None to leave it alone.

    The ranking is chosen by how many ranked points there are, so a scale reads the same whether
    or not it carries an escape hatch: four ranked points is `Not effective ... Very effective`,
    five is `Strongly disagree ... Strongly agree`.
    """
    if not values:
        return None
    has_escape_hatch = _is_escape_hatch(values[-1])
    ranked = values[:-1] if has_escape_hatch else values
    if any(_is_escape_hatch(value) for value in ranked):
        return None
    scale = RANKED_SCALES.get(len(ranked))
    if not scale:
        return None
    return scale + [NOT_SURE] if has_escape_hatch else list(scale)


def classify_legacy_likert(form_json):
    """Classify a form's unclassified Likert questions by the shape of their scale.

    Returns the rewritten form_json and whether anything changed, leaving the caller's copy alone.
    """
    updated = deepcopy(form_json)
    changed = False
    for values in _likert_values(updated):
        if any(value.get('classification') for value in values):
            continue
        scale = _scale_for(values)
        if not scale:
            continue
        for value, classification in zip(values, scale):
            value['classification'] = classification
        changed = True
    return updated, changed


def unclassify_legacy_likert(form_json):
    """Undo `classify_legacy_likert`, removing only the exact scales it writes.

    Only a question carrying one of this migration's scales, in its order, is cleared, so an
    author's own ranking survives the downgrade.

    With one unavoidable exception: the scales here are the ones authors themselves chose, so an
    author who already classified a question this way leaves behind something indistinguishable
    from this migration's work, and it is cleared too. Clearing is the safe direction - re-running
    the upgrade writes the identical scale back.
    """
    updated = deepcopy(form_json)
    changed = False
    for values in _likert_values(updated):
        if [value.get('classification') for value in values] not in MIGRATED_SCALES:
            continue
        for value in values:
            del value['classification']
        changed = True
    return updated, changed


def _rewrite_form_json(rewrite):
    """Apply `rewrite` to every survey's form_json, saving only the surveys it changed."""
    conn = op.get_bind()
    surveys = conn.execute(sa.text('SELECT id, form_json FROM survey')).fetchall()

    for survey_id, form_json in surveys:
        updated, changed = rewrite(form_json)
        if not changed:
            continue

        conn.execute(
            sa.text('UPDATE survey SET form_json = :form_json, updated_date = :now WHERE id = :survey_id')
            .bindparams(sa.bindparam('form_json', type_=postgresql.JSONB)),
            {'form_json': updated, 'now': datetime.utcnow(), 'survey_id': survey_id},
        )


def upgrade():
    _rewrite_form_json(classify_legacy_likert)


def downgrade():
    _rewrite_form_json(unclassify_legacy_likert)

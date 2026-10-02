"""Tests for the migration that classifies legacy Likert questions by the shape of their scale."""
import importlib.util
from pathlib import Path

import pytest


MIGRATION = (Path(__file__).parents[3] / 'migrations' / 'versions' /
             'e5d18c740b39_classify_legacy_likert_scales.py')


@pytest.fixture(scope='module')
def migration():
    """Load the migration module, whose filename is not importable."""
    spec = importlib.util.spec_from_file_location('classify_legacy_likert_scales', MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _question(labels, classifications=None):
    """Build a Likert question, unclassified unless classifications are given."""
    classifications = classifications or [None] * len(labels)
    values = []
    for label, classification in zip(labels, classifications):
        value = {'label': label, 'value': label}
        if classification:
            value['classification'] = classification
        values.append(value)
    return {'type': 'simplesurvey', 'key': labels[0], 'values': values}


def _classifications(form_json):
    """Return each question's classifications, in order."""
    return [[v.get('classification') for v in c['values']] for c in form_json['components']]


EFFECTIVE = ['Not effective', 'Somewhat effective', 'Effective', 'Very effective']
AGREE = ['Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree']


def test_four_point_scale_with_escape_hatch_has_no_neutral(migration):
    """`Somewhat effective` is the first positive rank; `Not sure` sits off the axis."""
    form = {'components': [_question(EFFECTIVE + ['Not sure / not applicable'])]}
    updated, changed = migration.classify_legacy_likert(form)
    assert changed
    assert _classifications(updated) == [['neg1', 'pos1', 'pos2', 'pos3', 'notSure']]
    assert _classifications(form) == [[None] * 5]


def test_four_point_scale_without_escape_hatch_has_no_neutral(migration):
    """Four ranked points read the same whether or not an escape hatch follows them."""
    updated, _ = migration.classify_legacy_likert({'components': [_question(EFFECTIVE)]})
    assert _classifications(updated) == [['neg1', 'pos1', 'pos2', 'pos3']]


def test_five_point_scale_keeps_its_neutral(migration):
    """A five-point scale's middle point is a real neutral."""
    updated, _ = migration.classify_legacy_likert({'components': [_question(AGREE + ['Not sure'])]})
    assert _classifications(updated) == [['neg2', 'neg1', 'neutral', 'pos1', 'pos2', 'notSure']]


@pytest.mark.parametrize('labels, expected', [
    (['Not preferred', 'Somewhat preferred', 'Preferred', 'Not sure'], ['neg1', 'pos1', 'pos2', 'notSure']),
    (['Not preferred', 'Somewhat preferred', 'Preferred'], ['neg1', 'pos1', 'pos2']),
    (['Publicly', 'Privately', 'Not sure'], ['neg1', 'pos1', 'notSure']),
    (['Publicly', 'Privately'], ['neg1', 'pos1']),
])
def test_short_scales_have_no_neutral(migration, labels, expected):
    """Two and three ranked points start at the one negative and climb the positive side."""
    updated, changed = migration.classify_legacy_likert({'components': [_question(labels)]})
    assert changed
    assert _classifications(updated) == [expected]


def test_authored_classifications_are_left_alone(migration):
    """A question an author ranked, neutral included, is never rewritten."""
    authored = ['neg1', 'neutral', 'pos1', 'pos2', 'notSure']
    form = {'components': [_question(EFFECTIVE + ['Not sure'], authored)]}
    updated, changed = migration.classify_legacy_likert(form)
    assert not changed
    assert updated == form


@pytest.mark.parametrize('labels', [
    ['Only option'],
    ['Only option', 'Not sure'],
    ['Not sure', 'Somewhat', 'Mostly', 'Fully', 'Completely'],
    ['a', 'b', 'c', 'd', 'e', 'f'],
])
def test_unrecognised_shapes_are_left_alone(migration, labels):
    """Lengths with no ranking, and an escape hatch out of last place, are not guessed at."""
    form = {'components': [_question(labels)]}
    _, changed = migration.classify_legacy_likert(form)
    assert not changed


def test_downgrade_clears_the_four_point_scale_it_wrote(migration):
    """The downgrade recognises the no-neutral four-point ranking as its own work."""
    classified, _ = migration.classify_legacy_likert({'components': [_question(EFFECTIVE + ['Not sure'])]})
    cleared, changed = migration.unclassify_legacy_likert(classified)
    assert changed
    assert _classifications(cleared) == [[None] * 5]


def test_downgrade_clears_the_short_scales_it_wrote(migration):
    """The downgrade recognises the two- and three-point rankings as its own work."""
    form = {'components': [_question(['Publicly', 'Privately', 'Not sure']),
                           _question(['Not preferred', 'Somewhat preferred', 'Preferred', 'Not sure'])]}
    classified, _ = migration.classify_legacy_likert(form)
    cleared, changed = migration.unclassify_legacy_likert(classified)
    assert changed
    assert _classifications(cleared) == [[None] * 3, [None] * 4]


def test_downgrade_leaves_an_authored_neutral_four_point_scale(migration):
    """A four-point scale an author ranked with a neutral is not this migration's work."""
    form = {'components': [_question(EFFECTIVE + ['Not sure'], ['neg1', 'neutral', 'pos1', 'pos2', 'notSure'])]}
    _, changed = migration.unclassify_legacy_likert(form)
    assert not changed

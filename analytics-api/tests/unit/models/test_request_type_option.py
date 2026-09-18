# Copyright © 2019 Province of British Columbia
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Tests for the RequestTypeOption model, in particular get_survey_result_with_type.

Test suite covering the matrix-question (Likert/Ranking) grouping logic that
powers the public/internal survey result dashboards.
"""
from analytics_api.models.request_type_option import RequestTypeOption as RequestTypeOptionModel
from tests.utilities.factory_utils import (
    factory_available_response_option_model, factory_request_type_option_model,
    factory_response_type_option_model, factory_survey_model)
from tests.utilities.factory_scenarios import TestSurveyInfo


def _survey(engagement_id):
    """Create a survey linked to the given (source system) engagement id.

    Survey.engagement_id stores the source-system engagement id directly -
    get_survey_result_with_type is queried by that same id, not by any analytics Engagement.id.
    """
    return factory_survey_model({**TestSurveyInfo.survey1.value, 'engagement_id': engagement_id})


def test_returns_none_when_no_questions(session):  # pylint:disable=unused-argument
    """Assert that an engagement with no survey questions returns None."""
    _survey(engagement_id=101)

    result = RequestTypeOptionModel.get_survey_result_with_type(101, True)

    assert result is None


def test_flat_question_result(session):  # pylint:disable=unused-argument
    """Assert that a plain (non-matrix) question returns a flat value/count result."""
    survey = _survey(engagement_id=102)
    factory_request_type_option_model(survey.id, 'radio1', 'simpleradios', 'Pick one', 'radio1', position=1)
    factory_available_response_option_model(survey.id, 'radio1', 'yes')
    factory_available_response_option_model(survey.id, 'radio1', 'no')
    factory_response_type_option_model(survey.id, 'radio1', 'yes')
    factory_response_type_option_model(survey.id, 'radio1', 'yes')
    factory_response_type_option_model(survey.id, 'radio1', 'no')

    result = RequestTypeOptionModel.get_survey_result_with_type(102, True)

    assert len(result) == 1
    entry = result[0]
    assert entry['key'] == 'radio1'
    assert entry['type'] == 'simpleradios'
    assert entry['question'] == 'Pick one'
    assert entry['result'] == [{'value': 'yes', 'count': 2}, {'value': 'no', 'count': 1}]


def test_excludes_inactive_questions(session):  # pylint:disable=unused-argument
    """Assert that inactive (deleted) questions are not returned."""
    survey = _survey(engagement_id=103)
    factory_request_type_option_model(
        survey.id, 'radio1', 'simpleradios', 'Pick one', 'radio1', position=1, is_active=False)

    result = RequestTypeOptionModel.get_survey_result_with_type(103, True)

    assert result is None


def test_hides_non_display_questions_for_public_view(session):  # pylint:disable=unused-argument
    """Assert that display=False questions are hidden from the public view but visible internally."""
    survey = _survey(engagement_id=104)
    factory_request_type_option_model(
        survey.id, 'hidden1', 'simpleradios', 'Hidden', 'hidden1', position=1, display=False)
    factory_request_type_option_model(
        survey.id, 'shown1', 'simpleradios', 'Shown (unset)', 'shown1', position=2, display=None)
    factory_available_response_option_model(survey.id, 'hidden1', 'yes')
    factory_available_response_option_model(survey.id, 'shown1', 'yes')

    public_result = RequestTypeOptionModel.get_survey_result_with_type(104, False)
    internal_result = RequestTypeOptionModel.get_survey_result_with_type(104, True)

    assert [e['key'] for e in public_result] == ['shown1']
    assert {e['key'] for e in internal_result} == {'hidden1', 'shown1'}


def test_likert_matrix_grouped_with_percentages(session):  # pylint:disable=unused-argument
    """Assert that a simplesurvey (Likert) parent groups its rows into a nested matrix result."""
    survey = _survey(engagement_id=105)
    factory_request_type_option_model(survey.id, 'likert1', 'simplesurvey', 'Satisfaction', 'likert1', position=1)
    factory_request_type_option_model(
        survey.id, 'rowA', 'simplesurvey', 'Row A', 'likert1-1', position=2)
    factory_request_type_option_model(
        survey.id, 'rowB', 'simplesurvey', 'Row B', 'likert1-2', position=3)

    for scale in ('agree', 'disagree'):
        factory_available_response_option_model(survey.id, 'rowA', scale)
        factory_available_response_option_model(survey.id, 'rowB', scale)

    factory_response_type_option_model(survey.id, 'rowA', 'agree')
    factory_response_type_option_model(survey.id, 'rowA', 'agree')
    factory_response_type_option_model(survey.id, 'rowA', 'agree')
    factory_response_type_option_model(survey.id, 'rowA', 'disagree')
    factory_response_type_option_model(survey.id, 'rowB', 'disagree')

    result = RequestTypeOptionModel.get_survey_result_with_type(105, True)

    assert len(result) == 1
    entry = result[0]
    assert entry['key'] == 'likert1'
    assert entry['type'] == 'simplesurvey'
    rows = {row['label']: row for row in entry['result']}
    assert rows['Row A']['n'] == 4
    assert rows['Row A']['pcts'] == [75, 25]
    assert rows['Row B']['n'] == 1
    assert rows['Row B']['pcts'] == [0, 100]


def test_ranking_matrix_sorts_scale_numerically(session):  # pylint:disable=unused-argument
    """Assert that ranking scale values (rank positions) are sorted numerically, not lexicographically."""
    survey = _survey(engagement_id=106)
    factory_request_type_option_model(survey.id, 'rank1', 'simpleranking', 'Rank these', 'rank1', position=1)
    factory_request_type_option_model(
        survey.id, 'stmt1', 'simpleranking', 'Statement 1', 'rank1-1', position=2)

    for value in ('10', '2', '1'):
        factory_available_response_option_model(survey.id, 'stmt1', value)
    factory_response_type_option_model(survey.id, 'stmt1', '1')
    factory_response_type_option_model(survey.id, 'stmt1', '10')

    result = RequestTypeOptionModel.get_survey_result_with_type(106, True)

    row = result[0]['result'][0]
    assert row['label'] == 'Statement 1'
    assert row['n'] == 2
    # numeric sort => ['1', '2', '10']; counts line up positionally with that order
    assert row['pcts'] == [50, 0, 50]


def test_orphaned_matrix_child_falls_back_to_flat(session):  # pylint:disable=unused-argument
    """Assert that a matrix-typed sub-question with no parent row is returned as a flat entry."""
    survey = _survey(engagement_id=107)
    factory_request_type_option_model(
        survey.id, 'rowA', 'simplesurvey', 'Row A', 'likert1-1', position=1)
    factory_available_response_option_model(survey.id, 'rowA', 'agree')
    factory_response_type_option_model(survey.id, 'rowA', 'agree')

    result = RequestTypeOptionModel.get_survey_result_with_type(107, True)

    assert len(result) == 1
    entry = result[0]
    assert entry['key'] == 'rowA'
    assert entry['result'] == [{'value': 'agree', 'count': 1}]


def test_matrix_entry_omitted_when_no_child_has_available_options(session):  # pylint:disable=unused-argument
    """Assert that a matrix parent whose children have no available response options is dropped entirely."""
    survey = _survey(engagement_id=108)
    factory_request_type_option_model(survey.id, 'likert1', 'simplesurvey', 'Satisfaction', 'likert1', position=1)
    factory_request_type_option_model(
        survey.id, 'rowA', 'simplesurvey', 'Row A', 'likert1-1', position=2)

    result = RequestTypeOptionModel.get_survey_result_with_type(108, True)

    assert result is None


def test_results_sorted_by_position(session):  # pylint:disable=unused-argument
    """Assert that results come back ordered by question position regardless of insertion order."""
    survey = _survey(engagement_id=109)
    factory_request_type_option_model(survey.id, 'second', 'simpleradios', 'Second', 'second', position=2)
    factory_request_type_option_model(survey.id, 'first', 'simpleradios', 'First', 'first', position=1)
    factory_available_response_option_model(survey.id, 'second', 'yes')
    factory_available_response_option_model(survey.id, 'first', 'yes')

    result = RequestTypeOptionModel.get_survey_result_with_type(109, True)

    assert [e['key'] for e in result] == ['first', 'second']


def test_respondent_count_counts_people_not_responses(session):  # pylint:disable=unused-argument
    """Assert that a multi-select question counts each person once, however many options they tick."""
    survey = _survey(engagement_id=110)
    factory_request_type_option_model(survey.id, 'check1', 'simplecheckboxes', 'Pick any', 'check1', position=1)
    factory_available_response_option_model(survey.id, 'check1', 'cycling')
    factory_available_response_option_model(survey.id, 'check1', 'walking')
    # Two people, four ticks between them.
    factory_response_type_option_model(survey.id, 'check1', 'cycling', participant_id=1)
    factory_response_type_option_model(survey.id, 'check1', 'walking', participant_id=1)
    factory_response_type_option_model(survey.id, 'check1', 'cycling', participant_id=2)
    factory_response_type_option_model(survey.id, 'check1', 'walking', participant_id=2)

    result = RequestTypeOptionModel.get_survey_result_with_type(110, True)

    entry = result[0]
    assert entry['respondent_count'] == 2
    assert sum(r['count'] for r in entry['result']) == 4


def test_respondent_count_ignores_responses_without_a_participant(session):  # pylint:disable=unused-argument
    """Assert that responses whose participant could not be resolved during ETL are not counted."""
    survey = _survey(engagement_id=111)
    factory_request_type_option_model(survey.id, 'radio1', 'simpleradios', 'Pick one', 'radio1', position=1)
    factory_available_response_option_model(survey.id, 'radio1', 'yes')
    factory_response_type_option_model(survey.id, 'radio1', 'yes', participant_id=1)
    factory_response_type_option_model(survey.id, 'radio1', 'yes', participant_id=None)

    result = RequestTypeOptionModel.get_survey_result_with_type(111, True)

    assert result[0]['respondent_count'] == 1


def test_matrix_respondent_count_unions_sub_questions(session):  # pylint:disable=unused-argument
    """Assert that a matrix counts anyone who answered any row, even if no single row saw them all.

    Taking the largest row count instead would report 1 here, since each person answered one row.
    """
    survey = _survey(engagement_id=112)
    factory_request_type_option_model(survey.id, 'likert1', 'simplesurvey', 'Satisfaction', 'likert1', position=1)
    factory_request_type_option_model(survey.id, 'rowA', 'simplesurvey', 'Row A', 'likert1-1', position=2)
    factory_request_type_option_model(survey.id, 'rowB', 'simplesurvey', 'Row B', 'likert1-2', position=3)
    factory_available_response_option_model(survey.id, 'rowA', 'agree')
    factory_available_response_option_model(survey.id, 'rowB', 'agree')
    # Each person answered one row and skipped the other.
    factory_response_type_option_model(survey.id, 'rowA', 'agree', participant_id=1)
    factory_response_type_option_model(survey.id, 'rowB', 'agree', participant_id=2)

    result = RequestTypeOptionModel.get_survey_result_with_type(112, True)

    entry = result[0]
    assert entry['key'] == 'likert1'
    assert [row['n'] for row in entry['result']] == [1, 1]
    assert entry['respondent_count'] == 2


def test_matrix_respondent_count_does_not_double_count_a_person(session):  # pylint:disable=unused-argument
    """Assert that someone who answered every row of a matrix still counts once."""
    survey = _survey(engagement_id=113)
    factory_request_type_option_model(survey.id, 'likert1', 'simplesurvey', 'Satisfaction', 'likert1', position=1)
    factory_request_type_option_model(survey.id, 'rowA', 'simplesurvey', 'Row A', 'likert1-1', position=2)
    factory_request_type_option_model(survey.id, 'rowB', 'simplesurvey', 'Row B', 'likert1-2', position=3)
    factory_available_response_option_model(survey.id, 'rowA', 'agree')
    factory_available_response_option_model(survey.id, 'rowB', 'agree')
    factory_response_type_option_model(survey.id, 'rowA', 'agree', participant_id=1)
    factory_response_type_option_model(survey.id, 'rowB', 'agree', participant_id=1)

    result = RequestTypeOptionModel.get_survey_result_with_type(113, True)

    assert result[0]['respondent_count'] == 1


def test_likert_sends_the_surveys_own_scale_wording(session):  # pylint:disable=unused-argument
    """Assert that a likert entry carries the scale wordings the survey author chose, in order."""
    survey = _survey(engagement_id=114)
    factory_request_type_option_model(survey.id, 'likert1', 'simplesurvey', 'Concern', 'likert1', position=1)
    factory_request_type_option_model(survey.id, 'rowA', 'simplesurvey', 'Row A', 'likert1-1', position=2)
    factory_request_type_option_model(survey.id, 'rowB', 'simplesurvey', 'Row B', 'likert1-2', position=3)
    for row in ('rowA', 'rowB'):
        for label in ('Not concerned', 'Neutral', 'Somewhat concerned', 'Concerned', 'Very concerned'):
            factory_available_response_option_model(survey.id, row, label)
    factory_response_type_option_model(survey.id, 'rowA', 'Neutral', participant_id=1)

    result = RequestTypeOptionModel.get_survey_result_with_type(114, True)

    assert result[0]['scale_labels'] == [
        'Not concerned', 'Neutral', 'Somewhat concerned', 'Concerned', 'Very concerned']


def test_ranking_sends_no_scale_labels(session):  # pylint:disable=unused-argument
    """Assert that ranking questions carry no scale wording - their values are rank positions."""
    survey = _survey(engagement_id=115)
    factory_request_type_option_model(survey.id, 'rank1', 'simpleranking', 'Rank these', 'rank1', position=1)
    factory_request_type_option_model(survey.id, 'optA', 'simpleranking', 'Option A', 'rank1-1', position=2)
    factory_available_response_option_model(survey.id, 'optA', '1')
    factory_available_response_option_model(survey.id, 'optA', '2')
    factory_response_type_option_model(survey.id, 'optA', '1', participant_id=1)

    result = RequestTypeOptionModel.get_survey_result_with_type(115, True)

    assert result[0]['type'] == 'simpleranking'
    assert result[0]['scale_labels'] == []


def test_hidden_matrix_takes_its_rows_with_it(session):  # pylint:disable=unused-argument
    """Assert that excluding a matrix from the public report hides its sub-questions too.

    A matrix carries one report setting, held against the parent component. Left behind, its rows
    have no parent to roll up into and would be served as orphaned flat entries the dashboard can
    only render as a warning.
    """
    survey = _survey(engagement_id=112)
    factory_request_type_option_model(
        survey.id, 'likert1', 'simplesurvey', 'Satisfaction', 'likert1', position=1, display=False)
    factory_request_type_option_model(
        survey.id, 'rowA', 'simplesurvey', 'Row A', 'likert1-1', position=2)
    factory_request_type_option_model(
        survey.id, 'rowB', 'simplesurvey', 'Row B', 'likert1-2', position=3)
    factory_request_type_option_model(survey.id, 'radio1', 'simpleradios', 'Pick one', 'radio1', position=4)

    for scale in ('agree', 'disagree'):
        factory_available_response_option_model(survey.id, 'rowA', scale)
        factory_available_response_option_model(survey.id, 'rowB', scale)
    factory_available_response_option_model(survey.id, 'radio1', 'yes')
    factory_response_type_option_model(survey.id, 'rowA', 'agree')
    factory_response_type_option_model(survey.id, 'radio1', 'yes')

    public_result = RequestTypeOptionModel.get_survey_result_with_type(112, False)
    internal_result = RequestTypeOptionModel.get_survey_result_with_type(112, True)

    assert [entry['key'] for entry in public_result] == ['radio1']
    assert {entry['key'] for entry in internal_result} == {'likert1', 'radio1'}


def test_available_response_option_stores_classification(session):  # pylint:disable=unused-argument
    """Assert that a Likert value keeps the classification the survey author gave it."""
    survey = _survey(engagement_id=120)

    option = factory_available_response_option_model(survey.id, 'rowA', 'Disagree', classification='neg2')
    legacy = factory_available_response_option_model(survey.id, 'rowA', 'Agree')

    assert option.classification == 'neg2'
    assert legacy.classification is None


def _likert(survey, points, rows=('rowA',)):
    """Create a Likert parent with one sub-question per row, each offering the given (label, classification) points."""
    factory_request_type_option_model(survey.id, 'likert1', 'simplesurvey', 'Agreement', 'likert1', position=1)
    for i, row in enumerate(rows, start=1):
        factory_request_type_option_model(
            survey.id, row, 'simplesurvey', f'Row {i}', f'likert1-{i}', position=i + 1)
        for label, classification in points:
            factory_available_response_option_model(survey.id, row, label, classification=classification)


def _answer(survey, row, label, times):
    for participant in range(times):
        factory_response_type_option_model(survey.id, row, label, participant_id=participant)


def test_classified_likert_is_ordered_by_classification(session):  # pylint:disable=unused-argument
    """Assert that scale points come back in rank order, whatever order the author listed them in."""
    survey = _survey(engagement_id=121)
    _likert(survey, [('Agree', 'pos1'), ('Disagree', 'neg2'), ('Strongly agree', 'pos2'),
                          ('Neutral', 'neutral'), ('Somewhat disagree', 'neg1')])
    _answer(survey, 'rowA', 'Disagree', 1)
    _answer(survey, 'rowA', 'Strongly agree', 3)

    entry = RequestTypeOptionModel.get_survey_result_with_type(121, True)[0]

    assert entry['scale'] == [
        {'label': 'Disagree', 'classification': 'neg2'},
        {'label': 'Somewhat disagree', 'classification': 'neg1'},
        {'label': 'Neutral', 'classification': 'neutral'},
        {'label': 'Agree', 'classification': 'pos1'},
        {'label': 'Strongly agree', 'classification': 'pos2'},
    ]
    assert entry['scale_labels'] == ['Disagree', 'Somewhat disagree', 'Neutral', 'Agree', 'Strongly agree']
    assert entry['has_not_sure'] is False
    assert entry['result'] == [{'label': 'Row 1', 'pcts': [25, 0, 0, 0, 75], 'n': 4, 'not_sure_pct': None}]


def test_not_sure_is_split_out_and_shares_the_denominator(session):  # pylint:disable=unused-argument
    """Assert that Not sure leaves the scale, and its percentage and the scale's share one total."""
    survey = _survey(engagement_id=122)
    _likert(survey, [('Disagree', 'neg1'), ('Not sure', 'notSure'), ('Neutral', 'neutral'),
                          ('Agree', 'pos1')])
    _answer(survey, 'rowA', 'Disagree', 3)
    _answer(survey, 'rowA', 'Not sure', 2)
    _answer(survey, 'rowA', 'Agree', 5)

    entry = RequestTypeOptionModel.get_survey_result_with_type(122, True)[0]

    assert [p['label'] for p in entry['scale']] == ['Disagree', 'Neutral', 'Agree']
    assert entry['has_not_sure'] is True
    row = entry['result'][0]
    assert row == {'label': 'Row 1', 'pcts': [30, 0, 50], 'n': 10, 'not_sure_pct': 20}
    assert sum(row['pcts']) + row['not_sure_pct'] == 100


def test_legacy_likert_keeps_stored_order(session):  # pylint:disable=unused-argument
    """Assert that a Likert with no classifications is served exactly as before."""
    survey = _survey(engagement_id=123)
    _likert(survey, [('Not effective', None), ('Neutral', None), ('Somewhat effective', None),
                          ('Effective', None), ('Very effective', None)])
    _answer(survey, 'rowA', 'Effective', 2)

    entry = RequestTypeOptionModel.get_survey_result_with_type(123, True)[0]

    assert entry['scale_labels'] == ['Not effective', 'Neutral', 'Somewhat effective', 'Effective', 'Very effective']
    assert [p['classification'] for p in entry['scale']] == [None] * 5
    assert entry['has_not_sure'] is False
    assert entry['result'] == [{'label': 'Row 1', 'pcts': [0, 0, 0, 100, 0], 'n': 2, 'not_sure_pct': None}]


def test_partly_classified_likert_is_treated_as_legacy(session):  # pylint:disable=unused-argument
    """Assert that one missing or unknown classification drops the whole scale back to stored order."""
    survey = _survey(engagement_id=124)
    _likert(survey, [('Agree', 'pos1'), ('Disagree', None), ('Unsure', 'maybe')])

    entry = RequestTypeOptionModel.get_survey_result_with_type(124, True)[0]

    assert entry['scale_labels'] == ['Agree', 'Disagree', 'Unsure']
    assert entry['has_not_sure'] is False


def test_ranking_entry_is_unaffected_by_classification(session):  # pylint:disable=unused-argument
    """Assert that ranking rows carry no Not sure field and an empty scale."""
    survey = _survey(engagement_id=125)
    factory_request_type_option_model(survey.id, 'rank1', 'simpleranking', 'Rank these', 'rank1', position=1)
    factory_request_type_option_model(survey.id, 'optA', 'simpleranking', 'Option A', 'rank1-1', position=2)
    factory_available_response_option_model(survey.id, 'optA', '2')
    factory_available_response_option_model(survey.id, 'optA', '1')
    factory_response_type_option_model(survey.id, 'optA', '1', participant_id=1)

    entry = RequestTypeOptionModel.get_survey_result_with_type(125, True)[0]

    assert entry['scale'] == []
    assert entry['has_not_sure'] is False
    assert entry['result'] == [{'label': 'Option A', 'pcts': [100, 0], 'n': 1}]


def test_duplicate_classification_is_treated_as_legacy(session):  # pylint:disable=unused-argument
    """Assert that a repeated classification drops the whole scale back to stored order.

    Builder validation blocks this going forward, but a second `notSure` (or a second `pos1`)
    would otherwise be silently dropped from counts and `n`, and two rows would render with
    the same colour.
    """
    survey = _survey(engagement_id=127)
    _likert(survey, [('Agree', 'pos1'), ('Strongly agree', 'pos1'), ('Not sure', 'notSure'),
                          ('Also not sure', 'notSure')])
    _answer(survey, 'rowA', 'Agree', 1)
    _answer(survey, 'rowA', 'Strongly agree', 2)
    _answer(survey, 'rowA', 'Not sure', 3)
    _answer(survey, 'rowA', 'Also not sure', 4)

    entry = RequestTypeOptionModel.get_survey_result_with_type(127, True)[0]

    assert entry['scale_labels'] == ['Agree', 'Strongly agree', 'Not sure', 'Also not sure']
    assert [p['classification'] for p in entry['scale']] == ['pos1', 'pos1', 'notSure', 'notSure']
    assert entry['has_not_sure'] is False
    row = entry['result'][0]
    assert row['n'] == 10
    assert row['not_sure_pct'] is None
    assert row['pcts'] == [10, 20, 30, 40]


def test_schema_serialises_scale_fields(session):  # pylint:disable=unused-argument
    """Assert that the response schema passes the new scale fields through to the dashboard."""
    from analytics_api.schemas.survey_result import SurveyResultSchema  # pylint:disable=import-outside-toplevel
    survey = _survey(engagement_id=126)
    _likert(survey, [('Disagree', 'neg1'), ('Not sure', 'notSure'), ('Agree', 'pos1')])
    _answer(survey, 'rowA', 'Not sure', 1)

    dumped = SurveyResultSchema(many=True).dump(RequestTypeOptionModel.get_survey_result_with_type(126, True))[0]

    assert dumped['scale'] == [{'label': 'Disagree', 'classification': 'neg1'},
                               {'label': 'Agree', 'classification': 'pos1'}]
    assert dumped['has_not_sure'] is True
    assert dumped['result'][0]['not_sure_pct'] == 100


def test_not_sure_on_a_later_row_still_shows_the_column(session):  # pylint:disable=unused-argument
    """Assert that a Not sure on any row turns the column on, so no row's pcts silently fall short."""
    survey = _survey(engagement_id=127)
    factory_request_type_option_model(survey.id, 'likert1', 'simplesurvey', 'Agreement', 'likert1', position=1)
    factory_request_type_option_model(survey.id, 'rowA', 'simplesurvey', 'Row 1', 'likert1-1', position=2)
    factory_request_type_option_model(survey.id, 'rowB', 'simplesurvey', 'Row 2', 'likert1-2', position=3)
    for label, classification in (('Disagree', 'neg1'), ('Agree', 'pos1')):
        factory_available_response_option_model(survey.id, 'rowA', label, classification=classification)
    for label, classification in (('Disagree', 'neg1'), ('Agree', 'pos1'), ('Not sure', 'notSure')):
        factory_available_response_option_model(survey.id, 'rowB', label, classification=classification)
    _answer(survey, 'rowA', 'Agree', 2)
    _answer(survey, 'rowB', 'Not sure', 1)

    entry = RequestTypeOptionModel.get_survey_result_with_type(127, True)[0]

    assert entry['has_not_sure'] is True
    assert entry['result'][1]['not_sure_pct'] == 100

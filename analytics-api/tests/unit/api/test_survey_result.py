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

"""Tests to verify the type aware survey results used by the results dashboard."""
from analytics_api.models.request_type_option import RequestTypeOption as RequestTypeOptionModel
from tests.utilities.factory_scenarios import TestSurveyInfo
from tests.utilities.factory_utils import (
    factory_available_response_option_model, factory_engagement_model, factory_request_type_option_model,
    factory_response_type_option_model, factory_survey_model)


AGE_OPTIONS = ['14-18', '19-34', '35+']
IMPORTANCE_SCALE = ['Least important', 'Neutral', 'Most important']


def _survey_for_engagement():
    """Create an engagement with a survey attached to it."""
    engagement = factory_engagement_model()
    survey = factory_survey_model({**TestSurveyInfo.survey1, 'engagement_id': engagement.id})
    return engagement, survey


def _radio_question(survey_id):
    """Create a radio question answered by three participants."""
    factory_request_type_option_model(survey_id, 'age', 'simpleradios', 'What is your age?', 1)
    factory_available_response_option_model(survey_id, 'age', AGE_OPTIONS)
    factory_response_type_option_model(survey_id, 'age', 1, ['35+'])
    factory_response_type_option_model(survey_id, 'age', 2, ['14-18'])
    factory_response_type_option_model(survey_id, 'age', 3, ['14-18'])


def _checkbox_question(survey_id):
    """Create a checkbox question where one of the two participants picked both options."""
    factory_request_type_option_model(survey_id, 'activities', 'simplecheckboxes', 'What do you do?', 2)
    factory_available_response_option_model(survey_id, 'activities', ['Hiking', 'Fishing'])
    factory_response_type_option_model(survey_id, 'activities', 1, ['Hiking', 'Fishing'])
    factory_response_type_option_model(survey_id, 'activities', 2, ['Hiking'])


def _likert_question(survey_id):
    """Create a likert matrix with two rows, answered by two participants."""
    factory_request_type_option_model(survey_id, 'valued', 'simplesurvey', 'Valued components', 3, 'm1')
    for index, (key, label) in enumerate([('valuedAir', 'Air quality'), ('valuedWater', 'Water quality')]):
        factory_request_type_option_model(survey_id, key, 'simplesurvey', label, 4 + index, f'm1-c{index}')
        factory_available_response_option_model(survey_id, key, IMPORTANCE_SCALE, f'm1-c{index}')
    factory_response_type_option_model(survey_id, 'valuedAir', 1, ['Most important'], 'm1-c0')
    factory_response_type_option_model(survey_id, 'valuedAir', 2, ['Least important'], 'm1-c0')
    factory_response_type_option_model(survey_id, 'valuedWater', 1, ['Neutral'], 'm1-c1')
    factory_response_type_option_model(survey_id, 'valuedWater', 2, ['Most important'], 'm1-c1')


def test_survey_result_keeps_survey_order(session):  # pylint:disable=unused-argument
    """Assert that questions and their options come back in the order they appear on the survey."""
    engagement, survey = _survey_for_engagement()
    _radio_question(survey.id)
    _checkbox_question(survey.id)

    results = RequestTypeOptionModel.get_survey_result_with_type(engagement.id, True)

    assert [result['key'] for result in results] == ['age', 'activities']
    age = results[0]
    # Options keep survey order, including the option nobody picked.
    assert [option['value'] for option in age['result']] == AGE_OPTIONS
    assert [option['count'] for option in age['result']] == [2, 0, 1]


def test_survey_result_counts_respondents(session):  # pylint:disable=unused-argument
    """Assert that respondents are counted per person, not per answer."""
    engagement, survey = _survey_for_engagement()
    _radio_question(survey.id)
    _checkbox_question(survey.id)

    results = RequestTypeOptionModel.get_survey_result_with_type(engagement.id, True)
    by_key = {result['key']: result for result in results}

    assert by_key['age']['respondents'] == 3
    # Three selections, but only two people made them.
    assert by_key['activities']['respondents'] == 2


def test_survey_result_matrix_includes_scale(session):  # pylint:disable=unused-argument
    """Assert that a likert matrix is rolled up into one entry carrying its answer scale."""
    engagement, survey = _survey_for_engagement()
    _likert_question(survey.id)

    results = RequestTypeOptionModel.get_survey_result_with_type(engagement.id, True)

    assert len(results) == 1
    matrix = results[0]
    assert matrix['key'] == 'valued'
    assert matrix['scale'] == IMPORTANCE_SCALE
    assert matrix['respondents'] == 2
    assert [row['label'] for row in matrix['result']] == ['Air quality', 'Water quality']
    assert matrix['result'][0]['pcts'] == [50, 0, 50]
    assert matrix['result'][0]['n'] == 2

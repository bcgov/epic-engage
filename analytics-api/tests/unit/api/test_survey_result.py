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

"""Tests to verify the survey result API end-point.

Test-Suite covering how the public endpoint answers for an engagement whose report staff are
holding back, which the dashboard tells the reader about.
"""
from http import HTTPStatus

from analytics_api.utils.util import ContentType
from tests.utilities.factory_scenarios import TestEngagementInfo, TestSurveyInfo
from tests.utilities.factory_utils import (
    factory_available_response_option_model, factory_engagement_model, factory_request_type_option_model,
    factory_response_type_option_model, factory_survey_model)


def _engagement(source_engagement_id, **overrides):
    """Create an active analytics engagement for the given source system engagement id."""
    return factory_engagement_model({
        **TestEngagementInfo.engagement1.value,
        'source_engagement_id': source_engagement_id,
        'status_name': 'Published',
        'send_report': True,
        **overrides,
    })


def _survey_with_a_result(source_engagement_id):
    """Create a survey with one answered question, so the endpoint has something to serve."""
    survey = factory_survey_model({**TestSurveyInfo.survey1.value, 'engagement_id': source_engagement_id})
    factory_request_type_option_model(survey.id, 'radio1', 'simpleradios', 'Pick one', 'radio1', position=1)
    factory_available_response_option_model(survey.id, 'radio1', 'yes')
    factory_response_type_option_model(survey.id, 'radio1', 'yes')
    return survey


def test_public_survey_result_is_served_for_a_public_report(client, session):  # pylint:disable=unused-argument
    """Assert that an engagement whose report is public gets its results."""
    _engagement(301)
    _survey_with_a_result(301)

    rv = client.get('/api/surveyresult/301/public', content_type=ContentType.JSON.value)

    assert rv.status_code == HTTPStatus.OK
    assert rv.json.get('data')


def test_public_survey_result_withheld_when_send_report_is_off(client, session):  # pylint:disable=unused-argument
    """Assert that switching Send Report off is reported as a refusal, not as an empty report.

    The dashboard cannot explain itself to the reader if a withheld report is indistinguishable
    from a survey nobody has answered.
    """
    _engagement(302, send_report=False)
    _survey_with_a_result(302)

    rv = client.get('/api/surveyresult/302/public', content_type=ContentType.JSON.value)

    assert rv.status_code == HTTPStatus.FORBIDDEN
    assert rv.json.get('reason') == 'send_report_off'


def test_public_survey_result_withheld_for_an_unpublished_engagement(client, session):  # pylint:disable=unused-argument
    """Assert that an unpublished engagement's report is refused with its own reason."""
    _engagement(303, status_name='Unpublished')
    _survey_with_a_result(303)

    rv = client.get('/api/surveyresult/303/public', content_type=ContentType.JSON.value)

    assert rv.status_code == HTTPStatus.FORBIDDEN
    assert rv.json.get('reason') == 'engagement_unpublished'


def test_public_survey_result_not_found_when_there_are_no_results(client, session):  # pylint:disable=unused-argument
    """Assert that an engagement nobody has answered is still 'no data', not a refusal."""
    _engagement(304)

    rv = client.get('/api/surveyresult/304/public', content_type=ContentType.JSON.value)

    assert rv.status_code == HTTPStatus.NOT_FOUND

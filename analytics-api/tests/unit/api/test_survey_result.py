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

import pytest
import requests

from analytics_api.utils.util import ContentType
from tests.utilities.factory_scenarios import TestEngagementInfo, TestSurveyInfo
from tests.utilities.factory_utils import (
    factory_auth_header, factory_available_response_option_model, factory_engagement_model,
    factory_request_type_option_model, factory_response_type_option_model, factory_survey_model)

SUB = 'f7a4a1d3-73a8-4cbc-a40f-bb1145302064'
TEAM_MEMBER_ROLES = ['access_dashboard']
SUPERUSER_ROLES = ['access_dashboard', 'view_all_survey_results']


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


def _get_internal(client, jwt, engagement_id, roles):
    headers = factory_auth_header(jwt, {'sub': SUB, 'realm_access': {'roles': roles}})
    return client.get(f'/api/surveyresult/{engagement_id}/internal', headers=headers,
                      content_type=ContentType.JSON.value)


@pytest.fixture
def met_api(app, mocker, monkeypatch):
    """Stand in for met-api's list of the caller's engagement memberships."""
    monkeypatch.setitem(app.config, 'MET_API_URL', 'http://met-api.test/api')
    response = mocker.Mock(status_code=200)
    response.json.return_value = []
    get = mocker.patch('analytics_api.utils.engagement_access_validator.requests.get', return_value=response)
    get.memberships = response.json
    return get


def test_internal_survey_result_needs_a_login(client, session, jwt):  # pylint:disable=unused-argument
    """Assert that the internal report is refused without a token."""
    _engagement(305)

    rv = client.get('/api/surveyresult/305/internal', content_type=ContentType.JSON.value)

    assert rv.status_code == HTTPStatus.UNAUTHORIZED


def test_internal_survey_result_for_a_superuser(client, session, jwt, met_api):  # pylint:disable=unused-argument
    """Assert that the global role opens any engagement's internal report without asking met-api."""
    _engagement(306)
    _survey_with_a_result(306)

    rv = _get_internal(client, jwt, 306, SUPERUSER_ROLES)

    assert rv.status_code == HTTPStatus.OK
    assert rv.json.get('data')
    met_api.assert_not_called()


def test_internal_survey_result_for_an_assigned_team_member(
        client, session, jwt, met_api):  # pylint:disable=unused-argument
    """Assert that a Team Member assigned to the engagement gets its internal report."""
    _engagement(307)
    _survey_with_a_result(307)
    met_api.memberships.return_value = [{'engagement_id': 307}]

    rv = _get_internal(client, jwt, 307, TEAM_MEMBER_ROLES)

    assert rv.status_code == HTTPStatus.OK
    assert rv.json.get('data')
    assert met_api.call_args.args[0] == f'http://met-api.test/api/engagements/all/members/{SUB}'


def test_internal_survey_result_refused_to_an_unassigned_team_member(
        client, session, jwt, met_api):  # pylint:disable=unused-argument
    """Assert that a Team Member assigned elsewhere is told they aren't assigned."""
    _engagement(308)
    _survey_with_a_result(308)
    met_api.memberships.return_value = [{'engagement_id': 1}]

    rv = _get_internal(client, jwt, 308, TEAM_MEMBER_ROLES)

    assert rv.status_code == HTTPStatus.FORBIDDEN
    assert rv.json.get('reason') == 'not_assigned'


def test_internal_survey_result_unavailable_when_membership_cannot_be_checked(
        client, session, jwt, met_api):  # pylint:disable=unused-argument
    """Assert that met-api being down is a 503, not a claim that the caller isn't assigned."""
    _engagement(309)
    _survey_with_a_result(309)
    met_api.side_effect = requests.exceptions.ConnectionError('met-api is down')

    rv = _get_internal(client, jwt, 309, TEAM_MEMBER_ROLES)

    assert rv.status_code == HTTPStatus.SERVICE_UNAVAILABLE
    assert 'reason' not in rv.json

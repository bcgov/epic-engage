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

"""Tests for who may read an engagement's internal report."""
from http import HTTPStatus

import pytest
import requests
from flask import g

from analytics_api.utils import engagement_access_validator
from analytics_api.utils.engagement_access_validator import MembershipCheckError

MET_API_URL = 'http://met-api.test/api'
SUB = 'f7a4a1d3-73a8-4cbc-a40f-bb1145302064'
AUTHORIZATION = 'Bearer a-team-members-token'


@pytest.fixture
def caller(app, monkeypatch):
    """Run the check inside a request made by a signed-in staff user holding the given roles."""
    monkeypatch.setitem(app.config, 'MET_API_URL', MET_API_URL)
    monkeypatch.setitem(app.config, 'JWT_ROLE_CALLBACK', lambda token: token['realm_access']['roles'])

    def _caller(roles):
        ctx = app.test_request_context(headers={'Authorization': AUTHORIZATION})
        ctx.push()
        g.jwt_oidc_token_info = {'sub': SUB, 'realm_access': {'roles': roles}}
        return ctx

    contexts = []
    yield lambda roles: contexts.append(_caller(roles))
    for ctx in reversed(contexts):
        ctx.pop()


def _met_api_answers(mocker, status=HTTPStatus.OK, memberships=None):
    response = mocker.Mock(status_code=status)
    response.json.return_value = memberships or []
    return mocker.patch('analytics_api.utils.engagement_access_validator.requests.get', return_value=response)


def test_role_holder_reads_any_internal_report_without_asking_met_api(caller, mocker):
    """Assert that the global role is enough on its own."""
    caller(['access_dashboard', 'view_all_survey_results'])
    met_api = _met_api_answers(mocker)

    assert engagement_access_validator.get_internal_report_denial_reason(7) is None
    met_api.assert_not_called()


def test_assigned_team_member_reads_the_internal_report(caller, mocker):
    """Assert that a membership on the engagement opens its internal report, asked as the caller."""
    caller(['access_dashboard'])
    met_api = _met_api_answers(mocker, memberships=[{'engagement_id': 3}, {'engagement_id': 7}])

    assert engagement_access_validator.get_internal_report_denial_reason('7') is None
    url = met_api.call_args.args[0]
    assert url == f'{MET_API_URL}/engagements/all/members/{SUB}'
    assert met_api.call_args.kwargs['headers']['Authorization'] == AUTHORIZATION


def test_team_member_assigned_elsewhere_is_refused_as_not_assigned(caller, mocker):
    """Assert that a membership on another engagement does not open this one, and says why."""
    caller(['access_dashboard'])
    _met_api_answers(mocker, memberships=[{'engagement_id': 3}])

    assert engagement_access_validator.get_internal_report_denial_reason(7) == 'not_assigned'


def test_check_fails_when_met_api_refuses(caller, mocker):
    """Assert that a refusal from met-api is not read as a membership, nor as proof of none."""
    caller(['access_dashboard'])
    _met_api_answers(mocker, status=HTTPStatus.FORBIDDEN)

    with pytest.raises(MembershipCheckError):
        engagement_access_validator.get_internal_report_denial_reason(7)


def test_check_fails_when_met_api_is_unreachable(caller, mocker):
    """Assert that an unanswered membership check is reported as a failure, not as 'not assigned'."""
    caller(['access_dashboard'])
    mocker.patch('analytics_api.utils.engagement_access_validator.requests.get',
                 side_effect=requests.exceptions.ConnectionError('met-api is down'))

    with pytest.raises(MembershipCheckError):
        engagement_access_validator.get_internal_report_denial_reason(7)


def test_check_fails_when_met_api_url_is_not_configured(caller, app, mocker, monkeypatch):
    """Assert that a missing MET_API_URL fails the check rather than calling a relative URL."""
    caller(['access_dashboard'])
    monkeypatch.setitem(app.config, 'MET_API_URL', '')
    met_api = _met_api_answers(mocker, memberships=[{'engagement_id': 7}])

    with pytest.raises(MembershipCheckError):
        engagement_access_validator.get_internal_report_denial_reason(7)
    met_api.assert_not_called()


def test_check_fails_when_met_api_answers_with_something_other_than_json(caller, mocker):
    """Assert that a 200 carrying, say, a proxy's HTML page is a failed check, not a crash."""
    caller(['access_dashboard'])
    response = _met_api_answers(mocker).return_value
    response.json.side_effect = ValueError('Expecting value: line 1 column 1 (char 0)')

    with pytest.raises(MembershipCheckError):
        engagement_access_validator.get_internal_report_denial_reason(7)


@pytest.mark.parametrize('body', [['7'], {'engagement_id': 7}, [None]])
def test_check_fails_when_met_api_answers_with_an_unexpected_shape(caller, mocker, body):
    """Assert that JSON that isn't a list of memberships is a failed check, not a crash."""
    caller(['access_dashboard'])
    _met_api_answers(mocker).return_value.json.return_value = body

    with pytest.raises(MembershipCheckError):
        engagement_access_validator.get_internal_report_denial_reason(7)

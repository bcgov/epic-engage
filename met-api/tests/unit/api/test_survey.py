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

"""Tests to verify the Engagement API end-point.

Test-Suite to ensure that the /Engagement endpoint is working as expected.
"""
import copy
from http import HTTPStatus
import json

from flask import current_app
import pytest

from met_api.constants.engagement_status import Status
from met_api.models.engagement import Engagement as EngagementModel
from met_api.models.membership import Membership as MembershipModel
from met_api.models.tenant import Tenant as TenantModel
from met_api.utils.constants import TENANT_ID_HEADER
from met_api.utils.enums import ContentType, MembershipStatus
from tests.utilities.factory_scenarios import TestJwtClaims, TestSurveyInfo, TestTenantInfo, TestUserInfo
from tests.utilities.factory_utils import (
    factory_auth_header, factory_engagement_model, factory_membership_model, factory_staff_user_model,
    factory_survey_and_eng_model, factory_survey_model, factory_tenant_model, set_global_tenant)


surveys_url = '/api/surveys/'


@pytest.mark.parametrize('survey_info', [TestSurveyInfo.survey1])
def test_create_survey(client, jwt, session, survey_info):  # pylint:disable=unused-argument
    """Assert that an survey can be POSTed."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)
    tenant_short_name = current_app.config.get('DEFAULT_TENANT_SHORT_NAME')
    headers[TENANT_ID_HEADER] = tenant_short_name
    data = {
        'name': survey_info.get('name'),
        'display': survey_info.get('form_json').get('display'),
    }
    rv = client.post(surveys_url, data=json.dumps(data),
                     headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == 200
    assert rv.json.get('form_json') == survey_info.get('form_json')


def test_create_survey_with_tenant(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that an survey can be POSTed."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)
    tenant_short_name = current_app.config.get('DEFAULT_TENANT_SHORT_NAME')
    tenant = TenantModel.find_by_short_name(tenant_short_name)
    assert tenant is not None
    headers[TENANT_ID_HEADER] = tenant_short_name

    rv = client.post(surveys_url, data=json.dumps({
        'name': TestSurveyInfo.survey1.get('name'),
        'display': TestSurveyInfo.survey1.get('form_json').get('display'),
    }), headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == 200
    survey_tenant_id = rv.json.get('tenant_id')
    assert survey_tenant_id == str(tenant.id)

    # Create a tenant
    tenant_data = TestTenantInfo.tenant2
    tenant_model = factory_tenant_model(tenant_data)
    tenant2_short_name = tenant_data['short_name']
    tenant_2 = TenantModel.find_by_short_name(tenant2_short_name)
    # Verify that the tenant was created successfully
    assert tenant_2 is not None

    # Set the tenant ID header for future requests
    headers[TENANT_ID_HEADER] = tenant2_short_name

    # Assert same staff admin can't create survey in a different tenant since he is a part of initial tenant.
    rv = client.post(surveys_url, data=json.dumps({
        'name': TestSurveyInfo.survey2.get('name'),
        'display': TestSurveyInfo.survey2.get('form_json').get('display'),
    }), headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == 403

    # emulate Tenant 2 staff admin by setting tenant id
    claims = copy.deepcopy(TestJwtClaims.staff_admin_role.value)
    claims['tenant_id'] = str(tenant_model.id)
    headers = factory_auth_header(jwt=jwt, claims=claims)
    headers[TENANT_ID_HEADER] = tenant2_short_name

    # Create a survey within the new tenant
    rv = client.post(surveys_url, data=json.dumps({
        'name': TestSurveyInfo.survey2.get('name'),
        'display': TestSurveyInfo.survey2.get('form_json').get('display'),
    }), headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == 200

    # Verify that the new survey belongs to the correct tenant
    survey_tenant_id = rv.json.get('tenant_id')
    assert survey_tenant_id == str(tenant_2.id)


@pytest.mark.parametrize('survey_info', [TestSurveyInfo.survey2])
def test_put_survey(client, jwt, session, survey_info):  # pylint:disable=unused-argument
    """Assert that an survey can be POSTed."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)
    survey = factory_survey_model()
    survey_id = str(survey.id)
    new_survey_name = 'new_survey_name'
    rv = client.put(surveys_url, data=json.dumps({'id': survey_id, 'name': new_survey_name}),
                    headers=headers, content_type=ContentType.JSON.value)

    assert rv.status_code == 200

    rv = client.get(f'{surveys_url}{survey_id}',
                    headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == 200
    assert rv.json.get('form_json') == survey_info.get('form_json')
    assert rv.json.get('name') == new_survey_name


def test_survey_link(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that a survey can be POSTed."""
    survey = factory_survey_model()
    survey_id = survey.id
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)

    eng = factory_engagement_model()
    eng_id = eng.id

    # assert eng id is none in GET Survey
    rv = client.get(
        f'{surveys_url}{survey_id}',
        headers=headers,
        content_type=ContentType.JSON.value
    )
    assert rv.json.get('engagement_id') is None

    # link them together
    client.put(
        f'{surveys_url}{survey_id}/link/engagement/{eng_id}',
        headers=headers,
        content_type=ContentType.JSON.value
    )

    rv = client.get(
        f'{surveys_url}{survey_id}',
        headers=headers,
        content_type=ContentType.JSON.value
    )
    assert rv.json.get('engagement_id') == str(eng_id)


def test_get_hidden_survey_for_admins(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that a hidden survey can be fetched by admins."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)
    set_global_tenant()
    factory_survey_model(TestSurveyInfo.hidden_survey)

    page = 1
    page_size = 10
    sort_key = 'survey.created_date'
    sort_order = 'desc'

    rv = client.get(f'{surveys_url}?page={page}&size={page_size}&sort_key={sort_key}\
                    &sort_order={sort_order}&search_text=', headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == 200
    assert rv.json.get('total') == 1


def test_get_survey_for_reviewer(client, jwt, session):  # pylint:disable=unused-argument
    """Assert reviewers different permission."""
    staff_1 = dict(TestUserInfo.user_staff_1)
    user = factory_staff_user_model(user_info=staff_1)
    claims = copy.deepcopy(TestJwtClaims.reviewer_role.value)
    claims['sub'] = str(user.external_id)
    headers = factory_auth_header(jwt=jwt, claims=claims)
    set_global_tenant()
    survey1 = factory_survey_model(TestSurveyInfo.survey1)

    # Attempt to access unlinked survey
    rv = client.get(f'{surveys_url}{survey1.id}',
                    headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == 403

    # Link to a draft engagement
    eng: EngagementModel = factory_engagement_model(status=Status.Draft.value)
    survey1.engagement_id = eng.id
    survey1.commit()

    # Attempt to access survey linked to draft engagement
    rv = client.get(f'{surveys_url}{survey1.id}',
                    headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == 403

    # Add user as a reviewer in the team
    factory_membership_model(user_id=user.id, engagement_id=eng.id, member_type='REVIEWER')

    # Assert Reviewer can see the survey since he is added to the team.
    rv = client.get(f'{surveys_url}{survey1.id}',
                    headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == 200

    # Deactivate membership
    membership_model: MembershipModel = MembershipModel.find_by_engagement_and_user_id(eng.id, user.id)
    membership_model.status = MembershipStatus.INACTIVE.value
    membership_model.commit()

    rv = client.get(f'{surveys_url}{survey1.id}',
                    headers=headers, content_type=ContentType.JSON.value)
    # Verify reviewer lost access after being removed from the team
    assert rv.status_code == 403

    # Publish the engagement
    eng.status_id = Status.Published.value
    eng.commit()
    rv = client.get(f'{surveys_url}{survey1.id}',
                    headers=headers, content_type=ContentType.JSON.value)

    # Assert user can access  the survey even when he is removed from the team since its published.
    assert rv.status_code == 200


def test_get_hidden_survey_for_team_member(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that a hidden survey cannot be fetched by team members."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.team_member_role)
    set_global_tenant()
    factory_survey_model(TestSurveyInfo.hidden_survey)

    page = 1
    page_size = 10
    sort_key = 'survey.created_date'
    sort_order = 'desc'

    rv = client.get(f'{surveys_url}?page={page}&size={page_size}&sort_key={sort_key}\
                    &sort_order={sort_order}&search_text=', headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == 200
    assert rv.json.get('total') == 0


def test_get_template_survey(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that a hidden survey cannot be fetched by team members."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)
    set_global_tenant()
    factory_survey_model(TestSurveyInfo.survey_template)

    page = 1
    page_size = 10
    sort_key = 'survey.created_date'
    sort_order = 'desc'

    rv = client.get(f'{surveys_url}?page={page}&size={page_size}&sort_key={sort_key}\
                    &sort_order={sort_order}&search_text=', headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == 200
    assert rv.json.get('total') == 1


def test_edit_template_survey_for_admins(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that a hidden survey cannot be fetched by team members."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)
    survey = factory_survey_model(TestSurveyInfo.survey_template)
    survey_id = str(survey.id)
    new_survey_name = 'new_survey_name'
    rv = client.put(surveys_url, data=json.dumps({'id': survey_id, 'name': new_survey_name}),
                    headers=headers, content_type=ContentType.JSON.value)

    assert rv.status_code == 200, 'Admins are able to edit template surveys'


def test_edit_template_survey_for_team_member(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that a hidden survey cannot be fetched by team members."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.team_member_role)
    survey = factory_survey_model(TestSurveyInfo.survey_template)
    survey_id = str(survey.id)
    new_survey_name = 'new_survey_name'
    rv = client.put(surveys_url, data=json.dumps({'id': survey_id, 'name': new_survey_name}),
                    headers=headers, content_type=ContentType.JSON.value)

    assert rv.status_code == 403, 'Team members are not able to edit template surveys, so throws exception.'


@pytest.mark.parametrize('survey_info', [TestSurveyInfo.survey2])
def test_surveys_clone_admin(mocker, client, jwt, session, survey_info):
    """Assert that a survey can be cloned."""
    survey = factory_survey_model()
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)

    # Prepare test data
    request_data = {'name': 'New Survey'}

    # Mock the SurveyService.get method
    mocker.patch(
        'met_api.services.survey_service.SurveyService.get',
        return_value=survey_info
    )

    # Make a POST request to the SurveysClone endpoint
    response = client.post(
        f'{surveys_url}{survey.id}/clone',
        data=json.dumps(request_data),
        headers=headers,
        content_type=ContentType.JSON.value
    )

    # Assert the response status code and data
    assert response.status_code == HTTPStatus.OK
    assert response.get_json().get('form_json') == survey.form_json


@pytest.mark.parametrize('survey_info', [TestSurveyInfo.survey2])
def test_surveys_clone_team_member(mocker, client, jwt, session, survey_info):
    """Assert that a survey can be cloned."""
    survey = factory_survey_model()
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.team_member_role)

    # Prepare test data
    request_data = {'name': 'New Survey'}

    # Mock the SurveyService.get method
    mocker.patch(
        'met_api.services.survey_service.SurveyService.get',
        return_value=survey_info
    )

    # Make a POST request to the SurveysClone endpoint
    response = client.post(
        f'{surveys_url}{survey.id}/clone',
        data=json.dumps(request_data),
        headers=headers,
        content_type=ContentType.JSON.value
    )

    # Assert the response status code and data
    assert response.status_code == HTTPStatus.OK
    assert response.get_json().get('form_json') == survey.form_json


wizard_survey_info = {
    **TestSurveyInfo.survey1.value,
    'form_json': {
        'display': 'wizard',
        'components': [
            {
                'type': 'panel', 'title': 'Page 1', 'key': 'page1', 'input': False,
                'components': [{'key': 'question1', 'input': True, 'type': 'simpletextfield'}],
            },
            {
                'type': 'panel', 'title': 'Page 2', 'key': 'page2', 'input': False,
                'components': [{'key': 'question2', 'input': True, 'type': 'simplecheckboxes'}],
            },
        ],
    },
}

wizard_survey_info_with_conditional = {
    **TestSurveyInfo.survey1.value,
    'form_json': {
        'display': 'wizard',
        'components': [
            {
                'type': 'panel', 'title': 'Page 1', 'key': 'page1', 'input': False,
                'components': [
                    {
                        'key': 'question1', 'input': True, 'type': 'simpleradios',
                        'values': [
                            {'value': 'yes', 'label': 'Yes'},
                            {'value': 'other', 'label': 'Other'},
                        ],
                    },
                    {
                        'key': 'followup1', 'input': True, 'type': 'simpletextarea',
                        'customConditional': "show = data.question1 === 'other';",
                    },
                ],
            },
        ],
    },
}


def test_get_survey_dashboard(client, session):  # pylint:disable=unused-argument
    """Assert that the dashboard endpoint returns the wizard page structure without auth."""
    survey, _ = factory_survey_and_eng_model(wizard_survey_info)

    rv = client.get(f'{surveys_url}{survey.id}/dashboard', content_type=ContentType.JSON.value)

    assert rv.status_code == HTTPStatus.OK
    assert rv.json.get('display') == 'wizard'
    pages = rv.json.get('pages')
    assert pages == [
        {'title': 'Page 1', 'questions': ['question1']},
        {'title': 'Page 2', 'questions': ['question2']},
    ]
    assert rv.json.get('conditional_links') == {}


def test_get_survey_dashboard_non_wizard(client, session):  # pylint:disable=unused-argument
    """Assert that a single page survey returns no pages for the dashboard."""
    survey, _ = factory_survey_and_eng_model()

    rv = client.get(f'{surveys_url}{survey.id}/dashboard', content_type=ContentType.JSON.value)

    assert rv.status_code == HTTPStatus.OK
    assert rv.json.get('pages') == []
    assert rv.json.get('conditional_links') == {}


def test_get_survey_dashboard_conditional_links(client, session):  # pylint:disable=unused-argument
    """Assert that a conditionally-shown follow-up question is grouped under its trigger."""
    survey, _ = factory_survey_and_eng_model(wizard_survey_info_with_conditional)

    rv = client.get(f'{surveys_url}{survey.id}/dashboard', content_type=ContentType.JSON.value)

    assert rv.status_code == HTTPStatus.OK
    assert rv.json.get('conditional_links') == {
        'followup1': {
            'trigger_key': 'question1',
            'row_key': None,
            'row_label': None,
            'trigger_values': ['other'],
            'trigger_value_labels': ['Other'],
        },
    }


def test_get_survey_dashboard_draft_engagement(client, session):  # pylint:disable=unused-argument
    """Assert that the dashboard endpoint hides surveys of unpublished engagements."""
    eng = factory_engagement_model(status=Status.Draft.value)
    survey = factory_survey_model()
    survey.engagement_id = eng.id
    survey.save()

    rv = client.get(f'{surveys_url}{survey.id}/dashboard', content_type=ContentType.JSON.value)

    assert rv.status_code == HTTPStatus.NOT_FOUND

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

"""Tests to verify the Report setting API end-point.

Test-Suite to ensure that the Report setting endpoint is working as expected.
"""
import json

from met_api.utils.enums import ContentType
from tests.utilities.factory_scenarios import TestJwtClaims, TestReportSettingInfo, TestSurveyInfo
from tests.utilities.factory_utils import (
    factory_auth_header, factory_survey_and_eng_model, factory_survey_report_setting_model)


def test_get_report_setting(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that report setting can be fetched."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)
    survey, _ = factory_survey_and_eng_model(TestSurveyInfo.survey3)

    report_setting_data = {
        **TestReportSettingInfo.report_setting_1,
        'survey_id': survey.id,
    }
    factory_survey_report_setting_model(report_setting_data)

    rv = client.get(
        f'/api/surveys/{survey.id}/reportsettings',
        headers=headers,
        content_type=ContentType.JSON.value
    )

    assert rv.status_code == 200


def test_patch_report_setting_authorized(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that a user with edit_survey role can update report setting."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)
    survey, _ = factory_survey_and_eng_model(TestSurveyInfo.survey3)

    report_setting_data = {
        **TestReportSettingInfo.report_setting_1,
        'survey_id': survey.id,
    }
    setting = factory_survey_report_setting_model(report_setting_data)

    rv = client.patch(
        f'/api/surveys/{survey.id}/reportsettings',
        data=json.dumps([{'id': setting.id, 'display': False}]),
        headers=headers,
        content_type=ContentType.JSON.value
    )

    assert rv.status_code == 200


def test_patch_report_setting_unauthorized(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that a user without edit access cannot update another tenant's report setting."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.public_user_role)
    survey, _ = factory_survey_and_eng_model(TestSurveyInfo.survey3)

    report_setting_data = {
        **TestReportSettingInfo.report_setting_1,
        'survey_id': survey.id,
    }
    setting = factory_survey_report_setting_model(report_setting_data)

    rv = client.patch(
        f'/api/surveys/{survey.id}/reportsettings',
        data=json.dumps([{'id': setting.id, 'display': False}]),
        headers=headers,
        content_type=ContentType.JSON.value
    )

    assert rv.status_code == 403


def test_get_report_setting_export_defaults(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that a new setting is included in the comment export and inherits its description."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)
    survey, _ = factory_survey_and_eng_model(TestSurveyInfo.survey3)
    factory_survey_report_setting_model({**TestReportSettingInfo.report_setting_1, 'survey_id': survey.id})

    rv = client.get(
        f'/api/surveys/{survey.id}/reportsettings',
        headers=headers,
        content_type=ContentType.JSON.value
    )

    assert rv.json[0]['export_display'] is True
    assert rv.json[0]['export_description'] is None


def test_patch_export_settings_leave_report_settings_alone(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that export and report fields can each be updated without touching the other."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)
    survey, _ = factory_survey_and_eng_model(TestSurveyInfo.survey3)
    setting = factory_survey_report_setting_model({
        **TestReportSettingInfo.report_setting_1,
        'survey_id': survey.id,
        'display': True,
        'description': 'Report description',
    })
    url = f'/api/surveys/{survey.id}/reportsettings'

    rv = client.patch(url, data=json.dumps([{'id': setting.id, 'export_display': False, 'export_description': ''}]),
                      headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == 200

    saved = client.get(url, headers=headers, content_type=ContentType.JSON.value).json[0]
    assert saved['display'] is True
    assert saved['description'] == 'Report description'
    assert saved['export_display'] is False
    assert saved['export_description'] == ''

    rv = client.patch(url, data=json.dumps([{'id': setting.id, 'display': False, 'description': None}]),
                      headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == 200

    saved = client.get(url, headers=headers, content_type=ContentType.JSON.value).json[0]
    assert saved['display'] is False
    assert saved['description'] is None
    assert saved['export_display'] is False
    assert saved['export_description'] == ''

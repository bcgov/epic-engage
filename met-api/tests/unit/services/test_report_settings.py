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
"""Tests for the report settings service.

Test suite to ensure that the Survey report settings service routines are working as expected.
"""
from met_api.services.report_setting_service import ReportSettingService
from tests.utilities.factory_scenarios import TestSurveyInfo
from tests.utilities.factory_utils import factory_survey_and_eng_model


def test_refresh_report_setting(session):  # pylint:disable=unused-argument
    """Assert report settings are refreshed."""
    survey, _ = factory_survey_and_eng_model(TestSurveyInfo.survey3)
    survey_data = {
        'id': survey.id,
        'form_json': survey.form_json,
    }
    result = ReportSettingService.refresh_report_setting(survey_data)
    assert result == survey_data

    report_settings = ReportSettingService.get_report_setting(survey.id)
    assert len(report_settings) == 1
    assert report_settings[0].get('survey_id') == survey.id


def test_refresh_report_setting_with_ranking(session):  # pylint:disable=unused-argument
    """Assert a ranking component creates a single report setting row."""
    survey, _ = factory_survey_and_eng_model(TestSurveyInfo.survey_with_ranking)
    survey_data = {
        'id': survey.id,
        'form_json': survey.form_json,
    }
    result = ReportSettingService.refresh_report_setting(survey_data)
    assert result == survey_data

    report_settings = ReportSettingService.get_report_setting(survey.id)
    # Ranking appears as a single row (not expanded per statement)
    assert len(report_settings) == 1
    assert report_settings[0].get('survey_id') == survey.id
    assert report_settings[0].get('question_type') == 'simpleranking'
    assert report_settings[0].get('question_key') == 'simpleranking'
    assert report_settings[0].get('question_id') == 'ranking1'


def test_refresh_report_setting_with_multiple_rankings(session):  # pylint:disable=unused-argument
    """Assert multiple ranking components with unique keys create separate report setting rows."""
    survey, _ = factory_survey_and_eng_model(TestSurveyInfo.survey_with_multiple_rankings)
    survey_data = {
        'id': survey.id,
        'form_json': survey.form_json,
    }
    ReportSettingService.refresh_report_setting(survey_data)

    report_settings = ReportSettingService.get_report_setting(survey.id)
    assert len(report_settings) == 2

    keys = [s.get('question_key') for s in report_settings]
    assert 'simpleranking' in keys
    assert 'simpleranking1' in keys

    types = [s.get('question_type') for s in report_settings]
    assert all(t == 'simpleranking' for t in types)

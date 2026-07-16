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

"""Tests to verify the /comments/survey/<survey_id>/grouped API end-point.

Test-Suite to ensure that free-text comments are correctly grouped by question.
"""
from met_api.utils.enums import ContentType
from tests.utilities.factory_scenarios import TestSubmissionInfo
from tests.utilities.factory_utils import (
    factory_comment_model, factory_engagement_setting_model, factory_participant_model,
    factory_submission_model, factory_survey_and_eng_model,
    factory_survey_report_setting_model)


def _approved_submission(survey, eng, participant):
    return factory_submission_model(
        survey.id, eng.id, participant.id, submission_info=TestSubmissionInfo.approved_submission)


def test_get_comments_grouped_by_question(client, session):  # pylint:disable=unused-argument
    """Assert that free-text comments come back grouped by question, excluding other question types."""
    participant = factory_participant_model()
    survey, eng = factory_survey_and_eng_model()
    factory_engagement_setting_model(eng.id, send_report=True)

    factory_survey_report_setting_model({
        'survey_id': survey.id,
        'question_key': 'simpletextarea1',
        'question_type': 'simpletextarea',
        'question': 'What do you think of the project?',
        'display': True,
    })
    factory_survey_report_setting_model({
        'survey_id': survey.id,
        'question_key': 'simpleradios1',
        'question_type': 'simpleradios',
        'question': 'What is your age?',
        'display': True,
    })

    submission_1 = _approved_submission(survey, eng, participant)
    submission_2 = _approved_submission(survey, eng, participant)
    factory_comment_model(survey.id, submission_1.id, comment_info={
        'text': 'Looks great', 'component_id': 'simpletextarea1', 'submission_date': None,
    })
    factory_comment_model(survey.id, submission_2.id, comment_info={
        'text': 'Needs more parking', 'component_id': 'simpletextarea1', 'submission_date': None,
    })
    factory_comment_model(survey.id, submission_1.id, comment_info={
        'text': '25-34', 'component_id': 'simpleradios1', 'submission_date': None,
    })

    rv = client.get(f'/api/comments/survey/{survey.id}/grouped', content_type=ContentType.JSON.value)

    assert rv.status_code == 200
    data = rv.json
    assert len(data) == 1
    assert data[0]['key'] == 'simpletextarea1'
    assert data[0]['type'] == 'simpletextarea'
    assert data[0]['count'] == 2
    assert set(data[0]['comments']) == {'Looks great', 'Needs more parking'}


def test_get_comments_grouped_excludes_unapproved(client, session):  # pylint:disable=unused-argument
    """Assert that comments still pending review are excluded from the grouped result."""
    participant = factory_participant_model()
    survey, eng = factory_survey_and_eng_model()
    factory_engagement_setting_model(eng.id, send_report=True)
    factory_survey_report_setting_model({
        'survey_id': survey.id,
        'question_key': 'simpletextarea1',
        'question_type': 'simpletextarea',
        'question': 'What do you think of the project?',
        'display': True,
    })

    approved_submission = _approved_submission(survey, eng, participant)
    pending_submission = factory_submission_model(
        survey.id, eng.id, participant.id, submission_info=TestSubmissionInfo.submission1)
    factory_comment_model(survey.id, approved_submission.id, comment_info={
        'text': 'Approved comment', 'component_id': 'simpletextarea1', 'submission_date': None,
    })
    factory_comment_model(survey.id, pending_submission.id, comment_info={
        'text': 'Pending comment', 'component_id': 'simpletextarea1', 'submission_date': None,
    })

    rv = client.get(f'/api/comments/survey/{survey.id}/grouped', content_type=ContentType.JSON.value)

    assert rv.status_code == 200
    data = rv.json
    assert len(data) == 1
    assert data[0]['count'] == 1
    assert data[0]['comments'] == ['Approved comment']


def test_get_comments_grouped_excludes_non_display_question(client, session):  # pylint:disable=unused-argument
    """Assert that a report setting with display=False produces no group for that question."""
    participant = factory_participant_model()
    survey, eng = factory_survey_and_eng_model()
    factory_engagement_setting_model(eng.id, send_report=True)
    factory_survey_report_setting_model({
        'survey_id': survey.id,
        'question_key': 'simpletextarea1',
        'question_type': 'simpletextarea',
        'question': 'Hidden question',
        'display': False,
    })

    submission = _approved_submission(survey, eng, participant)
    factory_comment_model(survey.id, submission.id, comment_info={
        'text': 'Should not show', 'component_id': 'simpletextarea1', 'submission_date': None,
    })

    rv = client.get(f'/api/comments/survey/{survey.id}/grouped', content_type=ContentType.JSON.value)

    assert rv.status_code == 200
    assert rv.json == []


def test_get_comments_grouped_empty_when_no_report_settings(client, session):  # pylint:disable=unused-argument
    """Assert that a survey with no report settings at all returns an empty list, not an error."""
    survey, eng = factory_survey_and_eng_model()
    factory_engagement_setting_model(eng.id, send_report=True)

    rv = client.get(f'/api/comments/survey/{survey.id}/grouped', content_type=ContentType.JSON.value)

    assert rv.status_code == 200
    assert rv.json == []

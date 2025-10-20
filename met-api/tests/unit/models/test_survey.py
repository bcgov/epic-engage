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
"""Tests for the Survey model.

Test suite to ensure that the Survey model routines are working as expected.
"""
from datetime import timedelta

from faker import Faker

from met_api.constants.engagement_status import Status
from met_api.models import Survey as SurveyModel
from met_api.models import db
from met_api.utils.datetime import local_datetime
from tests.utilities.factory_scenarios import TestEngagementInfo
from tests.utilities.factory_utils import factory_engagement_model, factory_survey_model

fake = Faker()


def test_survey(session):
    """Assert that an survey can be created and fetched."""
    survey = factory_survey_model()
    assert survey.id is not None
    survey_new = SurveyModel.find_by_id(survey.id)
    assert survey.name == survey_new.name


def test_get_open_survey(session):
    """Assert that an survey can be created and fetched."""
    survey = factory_survey_model()
    assert survey.id is not None
    survey_new = SurveyModel.get_open(survey.id)
    assert survey_new is None
    eng = factory_engagement_model(status=Status.Published.value)
    survey.engagement_id = eng.id
    db.session.add(survey)
    db.session.commit()
    survey_new_1 = SurveyModel.get_open(survey.id)
    assert survey_new_1 is not None


def test_get_open_survey_time_based(session):
    """Assert that an open survey can be retrieved based on time."""
    now = local_datetime().replace(tzinfo=None)
    eng_info: dict = TestEngagementInfo.engagement1
    eng_info['start_date'] = now - timedelta(days=1)  # Started 1 day ago
    eng_info['status'] = Status.Published.value

    # Test 1: Survey should be open (ended yesterday, within 1-day 8-hour grace period)
    eng_info['end_date'] = now - timedelta(days=1)  # Ended yesterday
    engagement = factory_engagement_model(eng_info)
    survey = factory_survey_model()
    survey.engagement_id = engagement.id

    session.add(engagement)
    session.add(survey)
    session.commit()

    # Should be retrievable (within grace period)
    survey_result = SurveyModel.get_open(survey.id)
    assert survey_result is not None, 'Survey should be fetchable within grace period'

    # Test 2: Survey should not be fetchable past the grace period (ended more than 1 day + 8 hours ago)
    eng_info['end_date'] = now - timedelta(days=1, hours=8, minutes=1)  # Ended 1 day + 8 hours + 1 minute ago
    engagement2 = factory_engagement_model(eng_info)
    survey2 = factory_survey_model()
    survey2.engagement_id = engagement2.id

    session.add(engagement2)
    session.add(survey2)
    session.commit()

    # Should NOT be retrievable (past grace period)
    survey_result2 = SurveyModel.get_open(survey2.id)
    assert survey_result2 is None, 'Survey should not be fetchable after grace period'

    # # Test 3: Survey should be open (ends today)
    eng_info['end_date'] = now  # Ends right now
    engagement3 = factory_engagement_model(eng_info)
    survey3 = factory_survey_model()
    survey3.engagement_id = engagement3.id

    session.add(engagement3)
    session.add(survey3)
    session.commit()

    # Should be retrievable (just ended, within grace period)
    survey_result3 = SurveyModel.get_open(survey3.id)
    assert survey_result3 is not None, 'Survey should be fetchable on end date'

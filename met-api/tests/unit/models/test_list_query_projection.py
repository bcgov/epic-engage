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
"""Tests for what the list queries count, fetch and bound.

These guard the three things the list responses were narrowed for: the counts have to keep
their old values now that SQL produces them, the queries must not fetch the columns and
relationships that were dropped, and every list has to stay paginated.
"""

from datetime import datetime

from sqlalchemy import inspect

from met_api.constants.comment_status import Status as CommentStatus
from met_api.constants.engagement_status import Status
from met_api.constants.user import SYSTEM_REVIEWER
from met_api.models.comment import Comment
from met_api.models.engagement import Engagement as EngagementModel
from met_api.models.engagement_scope_options import EngagementScopeOptions
from met_api.models.pagination_options import DEFAULT_SIZE, MAX_SIZE, PaginationOptions
from met_api.models.submission import Submission as SubmissionModel
from met_api.models.survey import Survey as SurveyModel
from met_api.models.survey_search_options import SurveySearchOptions
from met_api.schemas.engagement import EngagementSchema
from met_api.schemas.survey import SurveySchema
from met_api.services.engagement_service import ENGAGEMENT_LIST_FIELDS, ENGAGEMENT_LOOKUP_FIELDS
from met_api.services.survey_service import SURVEY_LIST_FIELDS
from tests.utilities.factory_scenarios import TestSurveyInfo
from tests.utilities.factory_utils import (
    factory_engagement_model, factory_participant_model, factory_submission_model, factory_survey_and_eng_model,
    factory_survey_model)


def _submission(status_id, reviewed_by):
    return {
        'submission_json': {'simpletextarea': 'a comment'},
        'created_by': '123',
        'updated_by': '123',
        'created_date': datetime.now().strftime('%Y-%m-%d'),
        'updated_date': datetime.now().strftime('%Y-%m-%d'),
        'comment_status_id': status_id,
        'reviewed_by': reviewed_by,
        'review_date': datetime.now().strftime('%Y-%m-%d'),
    }


def _pagination(page=1, size=10, sort_key='name', sort_order='asc'):
    return PaginationOptions(page=page, size=size, sort_key=sort_key, sort_order=sort_order)


def _scope():
    return EngagementScopeOptions(restricted=False, include_assigned=False, engagement_status_ids=None)


def _survey_search():
    return SurveySearchOptions(exclude_hidden=False, exclude_template=False)


def _refetch(session):
    """Drop the session's loaded objects, so a query's projection is what is measured."""
    session.expunge_all()


def test_counts_exclude_system_reviewer_but_keep_null_reviewer(session):
    """Assert the SQL counts reproduce what counting in Python produced.

    The null reviewer is the interesting one: in Python `!= 'System'` kept those rows, and
    the same comparison in SQL would silently drop them.
    """
    survey, engagement = factory_survey_and_eng_model()
    participant = factory_participant_model()
    factory_submission_model(survey.id, engagement.id, participant.id,
                             _submission(CommentStatus.Pending.value, None))
    factory_submission_model(survey.id, engagement.id, participant.id,
                             _submission(CommentStatus.Approved.value, SYSTEM_REVIEWER))
    factory_submission_model(survey.id, engagement.id, participant.id,
                             _submission(CommentStatus.Rejected.value, 'a staff reviewer'))

    counts = SubmissionModel.get_counts_by_survey_ids([survey.id])[survey.id]

    assert counts['total'] == 3, 'the total counts system-reviewed submissions'
    assert counts['pending'] == 1, 'a null reviewer is not the system reviewer'
    assert counts['approved'] == 0, 'the system reviewer is excluded from the status counts'
    assert counts['rejected'] == 1
    assert counts['needs_further_review'] == 0


def test_counts_are_zero_without_surveys_or_submissions(session):
    """Assert an engagement with no survey, and a survey with no submissions, report zeroes."""
    assert SubmissionModel.get_counts_by_survey_ids([]) == {}

    survey, _ = factory_survey_and_eng_model()
    assert SubmissionModel.get_counts_by_survey_ids([survey.id]) == {}

    engagement = factory_engagement_model()
    meta_data = EngagementSchema().dump(engagement)['submissions_meta_data']
    assert meta_data == {'total': 0, 'pending': 0, 'approved': 0, 'rejected': 0, 'needs_further_review': 0}


def test_submission_list_does_not_fetch_comments_or_submission_json(session):
    """Assert the compact list leaves the heavy column and the relationships unread."""
    survey, engagement = factory_survey_and_eng_model()
    participant = factory_participant_model()
    factory_submission_model(survey.id, engagement.id, participant.id,
                             _submission(CommentStatus.Pending.value, None))
    survey_id = survey.id

    _refetch(session)
    items, total = Comment.get_by_survey_id_paginated(survey_id, _pagination(sort_key='id'))

    assert total == 1
    unloaded = inspect(items[0]).unloaded
    assert 'submission_json' in unloaded
    assert 'comments' in unloaded
    assert 'staff_note' in unloaded

    _refetch(session)
    items, _ = Comment.get_by_survey_id_paginated(survey_id, _pagination(sort_key='id'), include_comments=True)
    assert 'submission_json' in inspect(items[0]).unloaded, 'submission_json is never part of a list'


def test_reduced_survey_list_does_not_select_form_json(session):
    """Assert reduce_data narrows the query to the two columns a selector needs."""
    survey, _ = factory_survey_and_eng_model()
    survey_id = survey.id

    _refetch(session)
    items, _ = SurveyModel.get_surveys_paginated(_pagination(), _survey_search(), reduce_data=True)

    fetched = next(item for item in items if item.id == survey_id)
    assert 'form_json' in inspect(fetched).unloaded
    assert 'is_hidden' in inspect(fetched).unloaded

    _refetch(session)
    items, _ = SurveyModel.get_surveys_paginated(_pagination(), _survey_search())
    fetched = next(item for item in items if item.id == survey_id)
    assert 'form_json' in inspect(fetched).unloaded, 'an ordinary list does not carry form_json either'

    _refetch(session)
    items, _ = SurveyModel.get_surveys_paginated(_pagination(), _survey_search(), include_form_json=True)
    fetched = next(item for item in items if item.id == survey_id)
    assert 'form_json' not in inspect(fetched).unloaded, 'the one caller that asks for it still gets it'


def test_engagement_list_does_not_fetch_long_form_content(session):
    """Assert the list query leaves the bulk of an engagement row in the database."""
    engagement = factory_engagement_model()
    engagement_id = engagement.id

    _refetch(session)
    items, _ = EngagementModel.get_engagements_paginated(None, _pagination(), _scope(), {'search_text': ''})

    fetched = next(item for item in items if item.id == engagement_id)
    unloaded = inspect(fetched).unloaded
    for dropped in ('content', 'rich_content', 'rich_description'):
        assert dropped in unloaded, f'{dropped} is not rendered by any list'
    assert 'name' not in unloaded, 'the fields the list does render are still fetched'


def test_survey_list_carries_the_engagement_columns_it_renders(session):
    """Assert the listing's engagement columns survive the projection.

    The table reads `engagement.published_date` through optional chaining, so leaving it out
    renders a blank cell instead of failing.
    """
    survey, _ = factory_survey_and_eng_model()
    survey_id = survey.id

    _refetch(session)
    items, _ = SurveyModel.get_surveys_paginated(_pagination(), _survey_search())

    fetched = next(item for item in items if item.id == survey_id)
    listed = SurveySchema(only=SURVEY_LIST_FIELDS).dump(fetched)
    assert set(listed['engagement']) == {
        'id', 'name', 'published_date', 'engagement_status', 'submission_status'}
    assert 'engagement' not in inspect(fetched).unloaded, 'the engagement comes off the existing join'


def test_has_surveys_filter_runs_in_sql(session):
    """Assert the filter keeps engagements with surveys, once each, and leaves the totals right."""
    survey, engagement_with_survey = factory_survey_and_eng_model()
    second_survey = factory_survey_model(TestSurveyInfo.survey1)
    second_survey.engagement_id = engagement_with_survey.id
    second_survey.save()
    factory_engagement_model(status=Status.Published.value)

    search_options = {'search_text': '', 'has_surveys': True}
    items, total = EngagementModel.get_engagements_paginated(None, _pagination(), _scope(), search_options)

    ids = [item.id for item in items]
    assert ids.count(engagement_with_survey.id) == 1, 'two surveys must not duplicate their engagement'
    assert total == len(ids)
    assert all(item.surveys for item in items)
    assert survey.engagement_id == engagement_with_survey.id


def test_list_queries_are_bounded(session):
    """Assert a missing page or size no longer means every matching row."""
    for _ in range(0, 3):
        factory_engagement_model()

    unbounded = PaginationOptions(page=None, size=None, sort_key='name', sort_order='asc')
    assert unbounded.bounded().page == 1
    assert unbounded.bounded().size == DEFAULT_SIZE
    assert PaginationOptions(page=0, size=-5, sort_key='name', sort_order='asc').bounded().size == DEFAULT_SIZE
    assert PaginationOptions(page=2, size=5000, sort_key='name', sort_order='asc').bounded().size == MAX_SIZE

    items, _ = EngagementModel.get_engagements_paginated(None, _pagination(size=2), _scope(), {'search_text': ''})
    assert len(items) == 2

    items, total = EngagementModel.get_engagements_paginated(None, unbounded, _scope(), {'search_text': ''})
    assert len(items) <= DEFAULT_SIZE
    assert total >= 3, 'the total still counts every match'


def test_list_responses_carry_only_their_own_fields(session):
    """Assert the list and lookup shapes drop what their callers never render."""
    survey, engagement = factory_survey_and_eng_model()

    listed = EngagementSchema(only=ENGAGEMENT_LIST_FIELDS).dump(engagement)
    for dropped in ('content', 'rich_content', 'rich_description', 'status_block'):
        assert dropped not in listed
    assert set(listed['surveys'][0]) == {'id', 'name'}
    assert listed['submissions_meta_data']['total'] == 0

    looked_up = EngagementSchema(only=ENGAGEMENT_LOOKUP_FIELDS).dump(engagement)
    assert set(looked_up) == {'id', 'name', 'surveys'}

    listed_survey = SurveySchema(only=SURVEY_LIST_FIELDS).dump(survey)
    assert 'form_json' not in listed_survey
    assert set(listed_survey['engagement']) == {
        'id', 'name', 'published_date', 'engagement_status', 'submission_status'}
    assert listed_survey['comments_meta_data']['total'] == 0

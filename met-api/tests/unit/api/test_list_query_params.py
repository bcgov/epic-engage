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

"""Tests for the query parameters that pick a list response shape.

These go through HTTP rather than the service, because the failure they guard against is in
the resource's argument parsing: a mis-spelled parameter name silently reads as False and the
endpoint quietly serves the wrong shape, which no service-level test would notice.

Each test pins the tenant: other suites leave the single-tenant config set on the app, and the
tenant filter then hides rows created without one.
"""
from http import HTTPStatus

from met_api.constants.comment_status import Status as CommentStatus
from met_api.models.pagination_options import DEFAULT_SIZE, MAX_SIZE
from tests.utilities.factory_scenarios import TestJwtClaims, TestSubmissionInfo
from tests.utilities.factory_utils import (
    factory_auth_header, factory_engagement_model, factory_participant_model, factory_submission_model,
    factory_survey_and_eng_model, set_global_tenant)


def test_engagement_list_has_surveys_filters_server_side(client, jwt, session):
    """Assert has_surveys keeps only the engagements a selector can act on."""
    set_global_tenant()
    _, engagement_with_survey = factory_survey_and_eng_model()
    engagement_without_survey = factory_engagement_model()
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)

    unfiltered = client.get('/api/engagements/?page=1&size=100', headers=headers)
    assert unfiltered.status_code == HTTPStatus.OK
    unfiltered_ids = [item['id'] for item in unfiltered.json['items']]
    assert engagement_with_survey.id in unfiltered_ids
    assert engagement_without_survey.id in unfiltered_ids

    filtered = client.get('/api/engagements/?page=1&size=100&has_surveys=true', headers=headers)
    assert filtered.status_code == HTTPStatus.OK
    filtered_ids = [item['id'] for item in filtered.json['items']]
    assert engagement_with_survey.id in filtered_ids
    assert engagement_without_survey.id not in filtered_ids, 'the parameter has to reach the query'


def test_engagement_list_lookup_only_narrows_the_response(client, jwt, session):
    """Assert lookup_only serves the selector shape and the default serves the list shape."""
    set_global_tenant()
    factory_survey_and_eng_model()
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)

    listed = client.get('/api/engagements/?page=1&size=10', headers=headers)
    assert listed.status_code == HTTPStatus.OK
    listed_item = listed.json['items'][0]
    assert 'submissions_meta_data' in listed_item
    for dropped in ('content', 'rich_content', 'rich_description'):
        assert dropped not in listed_item

    looked_up = client.get('/api/engagements/?page=1&size=10&lookup_only=true', headers=headers)
    assert looked_up.status_code == HTTPStatus.OK
    assert set(looked_up.json['items'][0]) == {'id', 'name', 'surveys'}


def test_survey_list_carries_the_columns_the_table_renders(client, jwt, session):
    """Assert the survey list keeps the engagement fields the listing reads."""
    set_global_tenant()
    factory_survey_and_eng_model()
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)

    rv = client.get('/api/surveys/?page=1&size=10', headers=headers)

    assert rv.status_code == HTTPStatus.OK
    item = rv.json['items'][0]
    assert 'form_json' not in item
    # The listing reads engagement_status.id, which raises rather than blanks when missing.
    assert item['engagement']['engagement_status']['id'] is not None
    assert 'published_date' in item['engagement']
    assert 'comments_meta_data' in item

    reduced = client.get('/api/surveys/?page=1&size=10&reduce_data=true', headers=headers)
    assert reduced.status_code == HTTPStatus.OK
    assert set(reduced.json['items'][0]) == {'id', 'name'}


def test_submission_list_shape_follows_include_comments(client, jwt, session):
    """Assert the compact list is the default and comments are opt-in."""
    set_global_tenant()
    survey, engagement = factory_survey_and_eng_model()
    participant = factory_participant_model()
    factory_submission_model(survey.id, engagement.id, participant.id, TestSubmissionInfo.submission1)
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)

    compact = client.get(f'/api/submissions/survey/{survey.id}?page=1&size=10', headers=headers)
    assert compact.status_code == HTTPStatus.OK
    item = compact.json['items'][0]
    for dropped in ('comments', 'staff_note', 'submission_json'):
        assert dropped not in item
    assert item['comment_status_id'] == CommentStatus.Pending.value

    with_comments = client.get(
        f'/api/submissions/survey/{survey.id}?page=1&size=10&include_comments=true', headers=headers)
    assert with_comments.status_code == HTTPStatus.OK
    detailed = with_comments.json['items'][0]
    assert 'comments' in detailed, 'the comment-text listing renders these'
    assert 'staff_note' not in detailed
    assert 'submission_json' not in detailed


def test_engagement_list_is_bounded(client, jwt, session):
    """Assert a request with no page or size gets a bounded page, not every row."""
    set_global_tenant()
    for _ in range(0, 3):
        factory_engagement_model()
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.staff_admin_role)

    unbounded = client.get('/api/engagements/', headers=headers)
    assert unbounded.status_code == HTTPStatus.OK
    assert len(unbounded.json['items']) <= DEFAULT_SIZE
    assert unbounded.json['total'] >= 3, 'the total still counts every match'

    oversized = client.get('/api/engagements/?page=1&size=5000', headers=headers)
    assert oversized.status_code == HTTPStatus.OK
    assert len(oversized.json['items']) <= MAX_SIZE

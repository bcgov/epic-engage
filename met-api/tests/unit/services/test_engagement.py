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
"""Tests for the Engagement service.

Test suite to ensure that the Engagement service routines are working as expected.
"""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from faker import Faker
import pytest

from met_api.models.submission import Submission as SubmissionModel
from met_api.services import authorization
from met_api.services.engagement_service import EngagementService
from tests.utilities.factory_scenarios import TestEngagementInfo, TestJwtClaims
from tests.utilities.factory_utils import factory_engagement_model, factory_staff_user_model, patch_token_info


fake = Faker()
date_format = '%Y-%m-%d'


def test_create_engagement(session, monkeypatch):  # pylint:disable=unused-argument
    """Assert that an Org can be created."""
    engagement_data = TestEngagementInfo.engagement1
    saved_engagament = EngagementService().create_engagement(engagement_data)
    # fetch the engagement with id and assert
    factory_staff_user_model()
    patch_token_info(TestJwtClaims.staff_admin_role, monkeypatch)
    fetched_engagement = EngagementService().get_engagement(saved_engagament.id)
    assert fetched_engagement.get('id') == saved_engagament.id
    assert fetched_engagement.get('name') == engagement_data.get('name')
    assert fetched_engagement.get('description') == engagement_data.get('description')
    assert fetched_engagement.get('start_date')  # TODO address date format and assert
    assert fetched_engagement.get('end_date')


def test_create_engagement_with_survey_block(session, monkeypatch):  # pylint:disable=unused-argument
    """Assert that an Org can be created."""
    engagement_data = TestEngagementInfo.engagement2
    saved_engagament = EngagementService().create_engagement(engagement_data)
    factory_staff_user_model()
    patch_token_info(TestJwtClaims.staff_admin_role, monkeypatch)
    # fetch the engagement with id and assert
    fetched_engagement = EngagementService().get_engagement(saved_engagament.id)
    assert fetched_engagement.get('id') == saved_engagament.id
    assert fetched_engagement.get('name') == engagement_data.get('name')
    assert fetched_engagement.get('description') == engagement_data.get('description')
    assert fetched_engagement.get('start_date')  # TODO address date format and assert
    assert fetched_engagement.get('end_date')


def test_patch_engagement(session, monkeypatch):  # pylint:disable=unused-argument
    """Assert that an Org can be created."""
    with patch.object(authorization, 'check_auth', return_value=True):
        saved_engagament_record = factory_engagement_model()
        saved_engagement_dict = {
            'id': saved_engagament_record.id,
            'name': saved_engagament_record.name,
            'start_date': saved_engagament_record.start_date,
            'end_date': saved_engagament_record.end_date,
            'description': saved_engagament_record.description,
            'content': saved_engagament_record.content,
            'created_date': saved_engagament_record.created_date,
            'status_id': saved_engagament_record.status_id,
        }

        engagement_edits = {
            'id': saved_engagament_record.id,
            'name': fake.name(),
            'start_date': fake.date(),
            'end_date': fake.date(),
            'description': fake.text(),
            'content': fake.text(),
            'created_date': fake.date(),
        }

        updated_engagement_record = EngagementService().edit_engagement(engagement_edits)

        # Assert that only edited fields have changed
        assert updated_engagement_record.status_id == saved_engagement_dict.get('status_id')
        assert updated_engagement_record.name == engagement_edits.get('name')
        assert updated_engagement_record.start_date.strftime(date_format) == engagement_edits.get('start_date')
        assert updated_engagement_record.end_date.strftime(date_format) == engagement_edits.get('end_date')
        assert updated_engagement_record.description == engagement_edits.get('description')
        assert updated_engagement_record.content == engagement_edits.get('content')
        assert updated_engagement_record.created_date.strftime(date_format) == engagement_edits.get('created_date')


TOKEN_PATH = '/protocol/openid-connect/token'


def _post(url, **_kwargs):
    response = MagicMock()
    response.json.return_value = {'access_token': 'closeout-token'}
    return response


@pytest.mark.parametrize('recipients, token_requests', [(3, 1), (0, 0)], ids=['three recipients', 'no recipients'])
def test_closeout_emails_share_one_token(app, monkeypatch, recipients, token_requests):
    """The closeout mail asks for one token for all recipients, and none when there is nobody to email."""
    for key, value in {
        'EAGLE_NOTIFY_EMAIL_ENDPOINT': 'https://eagle-notify.example.com/api/messages',
        'EPIC_JWT_OIDC_ISSUER': 'https://epic-kc.example.com/auth/realms/eao-epic',
        'EPIC_KEYCLOAK_SERVICE_ACCOUNT_ID': 'epic-user',
        'EPIC_KEYCLOAK_SERVICE_ACCOUNT_SECRET': 'epic-pw',
        'EPIC_KC_CLIENT_ID': 'epic-client',
    }.items():
        monkeypatch.setitem(app.config, key, value)
    participants = [SimpleNamespace(email_address=index, decode_email=lambda index: f'person{index}@example.com')
                    for index in range(recipients)]
    monkeypatch.setattr(EngagementService, '_render_email_template', lambda _engagement: ('subject', 'body', {}))
    monkeypatch.setattr(SubmissionModel, 'get_engaged_participants', lambda _engagement_id: participants)

    with app.app_context(), patch('requests.post', side_effect=_post) as mock_post:
        EngagementService._send_closeout_emails(SimpleNamespace(id=42))  # pylint: disable=protected-access

    urls = [call.args[0] for call in mock_post.call_args_list]
    assert len([url for url in urls if url.endswith(TOKEN_PATH)]) == token_requests
    assert len([url for url in urls if not url.endswith(TOKEN_PATH)]) == recipients

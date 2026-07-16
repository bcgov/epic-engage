# Copyright © 2024 Province of British Columbia
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
"""Tests for ProjectService — EPIC/EAO eagle-api integration."""
from http import HTTPStatus
from unittest.mock import MagicMock, patch

import pytest

from met_api.constants.engagement_status import Status
from met_api.services.project_service import ProjectService


PROJECT_ID = 'abc123projectid'
TRACKING_ID = '64f1a2b3c4d5e6f7a8b9c0d1'


def _make_metadata(project_id=PROJECT_ID, tracking_id=None):
    meta = MagicMock()
    meta.project_id = project_id
    meta.project_tracking_id = tracking_id
    return meta


def _make_engagement(status_id=Status.Published.value):
    eng = MagicMock()
    eng.id = 1
    eng.status_id = status_id
    eng.start_date = None
    eng.end_date = None
    eng.tenant_id = 1
    return eng


@pytest.mark.parametrize('status_id,expected_published', [
    (Status.Published.value, True),
    (Status.Closed.value, True),
    (Status.Draft.value, False),
    (Status.Scheduled.value, True),
    (Status.Unpublished.value, False),
])
def test_construct_epic_payload_is_published(app, status_id, expected_published):
    """Payload isPublished matches engagement publish state."""
    with app.app_context():
        with patch('met_api.services.project_service.notification') as mock_notif, \
             patch('met_api.services.project_service.EmailVerificationService') as mock_evs, \
             patch('met_api.services.project_service.convert_and_format_to_utc_str', return_value='2024-01-01'):
            mock_notif.get_tenant_site_url.return_value = 'https://engage.test/'
            mock_evs.get_engagement_path.return_value = '/engagements/test'
            eng = _make_engagement(status_id=status_id)
            payload = ProjectService._construct_epic_payload(eng, PROJECT_ID)

        assert payload['isPublished'] is expected_published
        assert payload['isMet'] is True  # must be bool, not string


def test_construct_epic_payload_fields(app):
    """Payload includes informationLabel (name) and instructions (description)."""
    with app.app_context():
        with patch('met_api.services.project_service.notification') as mock_notif, \
             patch('met_api.services.project_service.EmailVerificationService') as mock_evs, \
             patch('met_api.services.project_service.convert_and_format_to_utc_str', return_value='2024-01-01'), \
             patch('met_api.services.project_service.ObjectStorageService') as mock_oss:
            mock_notif.get_tenant_site_url.return_value = 'https://engage.test/'
            mock_evs.get_engagement_path.return_value = '/engagements/test'
            mock_oss().get_url.return_value = 'https://image.test/banner.webp'

            eng = _make_engagement()
            eng.name = 'Test Engagement'
            eng.description = 'Test Description'
            eng.banner_filename = 'banner.webp'

            payload = ProjectService._construct_epic_payload(eng, PROJECT_ID)

        assert payload['informationLabel'] == 'Test Engagement'
        assert payload['instructions'] == 'Test Description'
        assert payload['metBannerImageUrl'] == 'https://image.test/banner.webp'


def test_update_project_info_stores_underscore_id(app, session):
    """Tracking ID stored from _id (not id) in eagle-api POST response."""
    with app.app_context():
        with patch('met_api.services.project_service.EngagementModel') as mock_eng_model, \
             patch('met_api.services.project_service.EngagementMetadataModel') as mock_meta_model, \
             patch.object(ProjectService, '_construct_epic_payload', return_value={}), \
             patch.object(ProjectService, '_get_eao_service_account_token', return_value='token'), \
             patch('met_api.services.project_service.RestService') as mock_rest:

            app.config['IS_EAO_ENVIRONMENT'] = True
            app.config['EPIC_URL'] = 'https://eagle-dev/api/commentperiod'

            mock_engagement = _make_engagement()
            mock_eng_model.find_by_id.return_value = mock_engagement

            mock_meta = _make_metadata(project_id=PROJECT_ID, tracking_id=None)
            mock_meta_model.find_by_engagement_id.return_value = mock_meta

            mock_response = MagicMock()
            mock_response.status_code = HTTPStatus.OK
            mock_response.json.return_value = {'_id': TRACKING_ID, 'isMet': True}
            mock_rest.post.return_value = mock_response

            ProjectService.update_project_info(1)

            # project_tracking_id must be set to the '_id' value, not None
            assert mock_meta.project_tracking_id == TRACKING_ID
            mock_meta.commit.assert_called_once()


def test_update_project_info_uses_put_when_tracking_id_exists(app):
    """PUT is called (not POST) when project_tracking_id is already stored."""
    with app.app_context():
        with patch('met_api.services.project_service.EngagementModel') as mock_eng_model, \
             patch('met_api.services.project_service.EngagementMetadataModel') as mock_meta_model, \
             patch.object(ProjectService, '_construct_epic_payload', return_value={}), \
             patch.object(ProjectService, '_get_eao_service_account_token', return_value='token'), \
             patch('met_api.services.project_service.RestService') as mock_rest:

            app.config['IS_EAO_ENVIRONMENT'] = True
            app.config['EPIC_URL'] = 'https://eagle-dev/api/commentperiod'

            mock_eng_model.find_by_id.return_value = _make_engagement()
            mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)

            ProjectService.update_project_info(1)

            mock_rest.put.assert_called_once()
            mock_rest.post.assert_not_called()


def test_update_project_info_skips_when_no_project_id(app):
    """No eagle-api call when engagement has no project_id."""
    with app.app_context():
        with patch('met_api.services.project_service.EngagementModel') as mock_eng_model, \
             patch('met_api.services.project_service.EngagementMetadataModel') as mock_meta_model, \
             patch('met_api.services.project_service.RestService') as mock_rest:

            app.config['IS_EAO_ENVIRONMENT'] = True
            mock_eng_model.find_by_id.return_value = _make_engagement()
            mock_meta_model.find_by_engagement_id.return_value = _make_metadata(project_id=None)

            ProjectService.update_project_info(1)

            mock_rest.post.assert_not_called()
            mock_rest.put.assert_not_called()


def test_delete_from_epic_calls_rest_delete(app):
    """Delete call uses the tracking URL built from EPIC_URL and tracking ID."""
    with app.app_context():
        with patch('met_api.services.project_service.EngagementMetadataModel') as mock_meta_model, \
             patch.object(ProjectService, '_get_eao_service_account_token', return_value='token'), \
             patch('met_api.services.project_service.RestService') as mock_rest:

            app.config['IS_EAO_ENVIRONMENT'] = True
            app.config['EPIC_URL'] = 'https://eagle-dev/api/commentperiod'

            mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)

            ProjectService.delete_from_epic(1)

            expected_url = f'https://eagle-dev/api/commentperiod/{TRACKING_ID}'
            mock_rest.delete.assert_called_once_with(
                endpoint=expected_url, token='token', raise_for_status=False
            )


def test_delete_from_epic_skips_when_no_tracking_id(app):
    """No delete call when project_tracking_id is not set."""
    with app.app_context():
        with patch('met_api.services.project_service.EngagementMetadataModel') as mock_meta_model, \
             patch('met_api.services.project_service.RestService') as mock_rest:

            app.config['IS_EAO_ENVIRONMENT'] = True
            mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=None)

            ProjectService.delete_from_epic(1)

            mock_rest.delete.assert_not_called()

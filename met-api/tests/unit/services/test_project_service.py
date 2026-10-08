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
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from importlib import reload
import json
import logging
from unittest.mock import MagicMock, patch

import pytest
import requests

import met_api.config as met_config
from met_api.constants.engagement_status import Status
from met_api.services import project_service
from met_api.services.project_service import ProjectService
from met_api.services.rest_service import RestServiceConnectionError


PROJECT_ID = 'abc123projectid'
TRACKING_ID = '64f1a2b3c4d5e6f7a8b9c0d1'


def _make_metadata(project_id=PROJECT_ID, tracking_id=None):
    meta = MagicMock()
    meta.project_id = project_id
    meta.project_tracking_id = tracking_id
    meta.updated_date = None
    return meta


def _response(status=HTTPStatus.OK, body=None, text=''):
    resp = MagicMock()
    resp.status_code = status
    resp.json.return_value = body or {}
    resp.content = json.dumps(body).encode() if body is not None else b''
    resp.text = text
    return resp


def _make_engagement(status_id=Status.Published.value):
    eng = MagicMock()
    eng.id = 1
    eng.status_id = status_id
    eng.start_date = None
    eng.end_date = None
    eng.updated_date = None
    eng.tenant_id = 1
    eng.name = 'Engagement'
    eng.description = 'Description'
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


@pytest.fixture
def payload_env(app, monkeypatch):
    """Real date conversion with the site URL, engagement paths and banner storage patched."""
    monkeypatch.setitem(app.config, 'EPIC_MILESTONE', 'milestone-1')
    with app.app_context(), \
            patch('met_api.services.project_service.notification') as mock_notif, \
            patch('met_api.services.project_service.EmailVerificationService') as mock_evs, \
            patch('met_api.services.project_service.ObjectStorageService') as mock_oss:
        mock_notif.get_tenant_site_url.return_value = 'https://engage.test'
        mock_evs.get_engagement_path.side_effect = \
            lambda eng, is_public_url: '/engagements/7/view' if is_public_url else '/engagements/7/admin'
        mock_oss().get_url.return_value = 'https://image.test/banner.webp'
        yield


def _dated_engagement():
    eng = _make_engagement()
    eng.id = 7
    eng.name = 'Test Engagement'
    eng.description = 'Test Description'
    eng.banner_filename = 'banner.webp'
    # Local Vancouver times, UTC-7; kept before November so the tz database's BC rule change cannot move them.
    eng.start_date = datetime(2026, 10, 8, 9, 0)
    eng.end_date = datetime(2026, 10, 30, 23, 59)
    return eng


def test_construct_epic_payload_full_body(payload_env):
    """The Eagle body carries every comment period field, with dates in UTC."""
    payload = ProjectService._construct_epic_payload(_dated_engagement(), PROJECT_ID)

    assert payload == {
        'isMet': True,
        'metURL': 'https://engage.test/engagements/7/view',
        'metURLAdmin': 'https://engage.test/engagements/7/admin',
        'metBannerImageUrl': 'https://image.test/banner.webp',
        'dateStarted': '2026-10-08 16:00:00',
        'dateCompleted': '2026-10-31 06:59:00',
        'instructions': 'Test Description',
        'informationLabel': 'Test Engagement',
        'commentTip': '',
        'milestone': 'milestone-1',
        'openHouse': '',
        'relatedDocuments': '',
        'project': PROJECT_ID,
        'isPublished': True,
    }


def test_construct_demi_payload_full_body(payload_env):
    """The DEMI body carries the engagement, its Eagle ids, and the newest ENGAGE change as pushedAt."""
    eng = _dated_engagement()
    eng.updated_date = datetime(2026, 10, 8, 17, 0)
    meta = _make_metadata(tracking_id=TRACKING_ID)
    meta.updated_date = datetime(2026, 10, 8, 17, 30)

    body = ProjectService._construct_demi_payload(eng, meta)

    assert body == {
        'engagement': {
            'id': 7,
            'name': 'Test Engagement',
            'description': 'Test Description',
            'status': Status.Published.value,
            'metURL': 'https://engage.test/engagements/7/view',
            'metURLAdmin': 'https://engage.test/engagements/7/admin',
            'bannerUrl': 'https://image.test/banner.webp',
            'start': '2026-10-08 16:00:00',
            'end': '2026-10-31 06:59:00',
            'isPublished': True,
            'projectId': PROJECT_ID,
            'trackingId': TRACKING_ID,
            'isDeleted': False,
        },
        'pushedAt': '2026-10-08T17:30:00+00:00',
    }


def test_demi_pushed_at_uses_engagement_date_when_newer(payload_env):
    """The pushedAt value is the later of the two update dates, whichever row it is on."""
    eng = _dated_engagement()
    eng.updated_date = datetime(2026, 10, 9, 1, 2, 3)
    meta = _make_metadata()
    meta.updated_date = datetime(2026, 10, 8, 17, 30)

    assert ProjectService._construct_demi_payload(eng, meta)['pushedAt'] == '2026-10-09T01:02:03+00:00'


def test_demi_pushed_at_falls_back_to_now(payload_env):
    """With no update dates at all, pushedAt is the current UTC time."""
    before = datetime.now(timezone.utc)
    pushed_at = datetime.fromisoformat(
        ProjectService._construct_demi_payload(_dated_engagement(), _make_metadata())['pushedAt'])

    assert before <= pushed_at <= datetime.now(timezone.utc) + timedelta(seconds=1)


def test_update_project_info_stores_underscore_id(app):
    """Tracking ID stored from _id (not id) in eagle-api POST response."""
    with app.app_context():
        with patch('met_api.services.project_service.EngagementModel') as mock_eng_model, \
             patch('met_api.services.project_service.EngagementMetadataModel') as mock_meta_model, \
             patch.object(ProjectService, '_get_project_type', return_value='project'), \
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
             patch.object(ProjectService, '_get_project_type', return_value='project'), \
             patch.object(ProjectService, '_construct_epic_payload', return_value={}), \
             patch.object(ProjectService, '_get_eao_service_account_token', return_value='token'), \
             patch('met_api.services.project_service.RestService') as mock_rest:

            app.config['IS_EAO_ENVIRONMENT'] = True
            app.config['EPIC_URL'] = 'https://eagle-dev/api/commentperiod'

            mock_eng_model.find_by_id.return_value = _make_engagement()
            mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)
            mock_rest.put.return_value = _response()

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
             patch.object(ProjectService, '_get_project_type', return_value='project'), \
             patch.object(ProjectService, '_get_eao_service_account_token', return_value='token'), \
             patch('met_api.services.project_service.RestService') as mock_rest:

            app.config['IS_EAO_ENVIRONMENT'] = True
            app.config['EPIC_URL'] = 'https://eagle-dev/api/commentperiod'

            mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)
            mock_rest.delete.return_value = _response()

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


def test_update_project_info_project_notification(app):
    """Verify that update_project_info correctly fetches, merges, and PUTs for project notifications."""
    with app.app_context():
        with patch('met_api.services.project_service.EngagementModel') as mock_eng_model, \
             patch('met_api.services.project_service.EngagementMetadataModel') as mock_meta_model, \
             patch.object(ProjectService, '_get_project_type', return_value='notification'), \
             patch.object(ProjectService, '_get_eao_service_account_token', return_value='token'), \
             patch('met_api.services.project_service.notification') as mock_notif, \
             patch('met_api.services.project_service.EmailVerificationService') as mock_evs, \
             patch('met_api.services.project_service.requests.get') as mock_get, \
             patch('met_api.services.project_service.RestService') as mock_rest:

            app.config['IS_EAO_ENVIRONMENT'] = True
            app.config['EPIC_URL'] = 'https://eagle-dev/api/commentperiod'

            mock_notif.get_tenant_site_url.return_value = 'https://engage.test/'
            mock_evs.get_engagement_path.return_value = '/engagements/test'

            eng = _make_engagement()
            eng.start_date = None
            eng.end_date = None
            mock_eng_model.find_by_id.return_value = eng

            mock_meta = _make_metadata(project_id=PROJECT_ID, tracking_id=None)
            mock_meta_model.find_by_engagement_id.return_value = mock_meta

            # Mock GET response returning existing project notification
            mock_resp = MagicMock()
            mock_resp.status_code = HTTPStatus.OK
            mock_resp.json.return_value = {'_id': PROJECT_ID, 'name': 'Notification Name'}
            mock_get.return_value = mock_resp
            mock_rest.put.return_value = _response()

            ProjectService.update_project_info(1)

            # verify get was called with correct URL
            mock_get.assert_called_once_with(
                'https://eagle-dev/api/projectNotification/abc123projectid',
                headers={'Authorization': 'Bearer token'},
                timeout=10
            )

            # verify RestService.put was called with correct payload and publish query param
            mock_rest.put.assert_called_once()
            kwargs = mock_rest.put.call_args[1]
            assert kwargs['endpoint'] == 'https://eagle-dev/api/projectNotification/abc123projectid?publish=true'
            assert kwargs['data']['pcp'] == 'open'
            assert kwargs['data']['name'] == 'Notification Name'
            assert kwargs['data']['isMet'] is True


def test_delete_from_epic_project_notification(app):
    """Verify that delete_from_epic clears comment period fields and PUTs publish=false for project notifications."""
    with app.app_context():
        with patch('met_api.services.project_service.EngagementMetadataModel') as mock_meta_model, \
             patch.object(ProjectService, '_get_project_type', return_value='notification'), \
             patch.object(ProjectService, '_get_eao_service_account_token', return_value='token'), \
             patch('met_api.services.project_service.requests.get') as mock_get, \
             patch('met_api.services.project_service.RestService') as mock_rest:

            app.config['IS_EAO_ENVIRONMENT'] = True
            app.config['EPIC_URL'] = 'https://eagle-dev/api/commentperiod'

            mock_meta = _make_metadata(project_id=PROJECT_ID, tracking_id=TRACKING_ID)
            mock_meta_model.find_by_engagement_id.return_value = mock_meta

            mock_resp = MagicMock()
            mock_resp.status_code = HTTPStatus.OK
            mock_resp.json.return_value = {'_id': PROJECT_ID, 'name': 'Notification Name'}
            mock_get.return_value = mock_resp
            mock_rest.put.return_value = _response()

            ProjectService.delete_from_epic(1)

            # verify RestService.put was called with cleared commenting fields and publish=false
            mock_rest.put.assert_called_once()
            kwargs = mock_rest.put.call_args[1]
            assert kwargs['endpoint'] == 'https://eagle-dev/api/projectNotification/abc123projectid?publish=false'
            assert kwargs['data']['pcp'] == 'none'
            assert kwargs['data']['isMet'] is False
            assert kwargs['data']['metURL'] == ''
            mock_rest.delete.assert_not_called()


DEMI_URL = 'https://demi.test/api'
DEMI_KEY = 'test-subscription-key'
EAGLE_ID = '650000000000000000000001'


@pytest.fixture
def push_env(app, monkeypatch):
    """Comment period push context: EAO env on, models and Eagle lookups patched, RestService real."""
    # The test DB migration runs logging.config.fileConfig, which disables loggers created before it.
    monkeypatch.setattr(project_service.logger, 'disabled', False)
    monkeypatch.setitem(app.config, 'IS_EAO_ENVIRONMENT', True)
    monkeypatch.setitem(app.config, 'EPIC_URL', 'https://eagle-dev/api/commentperiod')
    monkeypatch.setitem(app.config, 'DEMI_API_URL', DEMI_URL)
    monkeypatch.setitem(app.config, 'DEMI_API_KEY', DEMI_KEY)
    with app.app_context(), \
            patch('met_api.services.project_service.EngagementModel') as mock_eng_model, \
            patch('met_api.services.project_service.EngagementMetadataModel') as mock_meta_model, \
            patch.object(ProjectService, '_get_project_type', return_value='project'), \
            patch.object(ProjectService, '_get_eao_service_account_token', return_value='token'), \
            patch.object(ProjectService, '_construct_epic_payload', return_value={}), \
            patch.object(ProjectService, '_engagement_fields', return_value={}):
        mock_eng_model.find_by_id.return_value = _make_engagement()
        yield mock_meta_model


@pytest.fixture
def cp_env(push_env):
    """push_env with RestService patched."""
    with patch('met_api.services.project_service.RestService') as mock_rest:
        yield push_env, mock_rest


def _set_target(app, monkeypatch, target):
    monkeypatch.setitem(app.config, 'EPIC_SYNC_TARGET', target)


def test_update_project_info_logs_failed_put(cp_env, caplog):
    """A non-2xx Eagle PUT is logged at error with the ids, status and a capped body."""
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)
    mock_rest.put.return_value = _response(HTTPStatus.FORBIDDEN, text='x' * 600)

    assert ProjectService.update_project_info(1) is False

    errors = [r for r in caplog.records if r.levelname == 'ERROR']
    assert len(errors) == 1
    message = errors[0].getMessage()
    assert 'PUT' in message and 'status=403' in message
    assert 'engagement_id=1' in message and PROJECT_ID in message and TRACKING_ID in message
    assert 'x' * 501 not in message


def test_update_project_info_logs_failed_post(cp_env, caplog):
    """A non-2xx Eagle POST is logged at error and stores no tracking id."""
    mock_meta_model, mock_rest = cp_env
    meta = _make_metadata(tracking_id=None)
    mock_meta_model.find_by_engagement_id.return_value = meta
    mock_rest.post.return_value = _response(HTTPStatus.INTERNAL_SERVER_ERROR, text='boom')

    assert ProjectService.update_project_info(1) is False

    message = next(r.getMessage() for r in caplog.records if r.levelname == 'ERROR')
    assert 'POST' in message and 'status=500' in message and 'engagement_id=1' in message
    assert 'response=boom' in message
    assert meta.project_tracking_id is None


def test_update_project_info_logs_exception_with_ids(cp_env, caplog):
    """An exception is swallowed, logged with the engagement and project ids, and the session rolled back."""
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)
    mock_rest.put.side_effect = RuntimeError('connection reset')

    with patch('met_api.services.project_service.db') as mock_db:
        assert ProjectService.update_project_info(7) is False

    record = next(r for r in caplog.records if r.levelname == 'ERROR')
    assert 'engagement_id=7' in record.getMessage() and PROJECT_ID in record.getMessage()
    assert record.exc_info is not None
    mock_db.session.rollback.assert_called_once()


def test_update_project_info_rolls_back_outside_the_push(cp_env, caplog):
    """An exception before any push (token fetch) is swallowed, rolled back and reported as a failure."""
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)

    with patch.object(ProjectService, '_get_eao_service_account_token', side_effect=RuntimeError('kc down')), \
            patch('met_api.services.project_service.db') as mock_db:
        assert ProjectService.update_project_info(7) is False

    mock_db.session.rollback.assert_called_once()
    mock_rest.put.assert_not_called()
    assert 'engagement_id=7' in next(r.getMessage() for r in caplog.records if r.levelname == 'ERROR')


def test_connection_error_logs_one_line(cp_env, caplog):
    """A connection error is logged once at error, with no traceback, and does not raise."""
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)
    mock_rest.put.side_effect = RestServiceConnectionError('refused')

    assert ProjectService.update_project_info(7) is False

    errors = [r for r in caplog.records if r.levelname == 'ERROR' and r.name == project_service.logger.name]
    assert len(errors) == 1
    assert 'RestServiceConnectionError' in errors[0].getMessage() and 'engagement_id=7' in errors[0].getMessage()
    assert errors[0].exc_info is None


def test_demi_mode_sends_only_demi_put(app, monkeypatch, cp_env):
    """Mode demi sends one PUT to DEMI with the subscription key and nothing to Eagle."""
    _set_target(app, monkeypatch, 'demi')
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)
    mock_rest.put.return_value = _response()

    ProjectService.update_project_info(1)

    mock_rest.put.assert_called_once()
    mock_rest.post.assert_not_called()
    kwargs = mock_rest.put.call_args.kwargs
    assert kwargs['endpoint'] == f'{DEMI_URL}/engage/engagements/1'
    assert kwargs['additional_headers'] == {'Ocp-Apim-Subscription-Key': DEMI_KEY}
    assert kwargs['generate_token'] is False
    assert 'token' not in kwargs
    assert kwargs['data']['engagement']['trackingId'] == TRACKING_ID
    assert kwargs['data']['engagement']['isDeleted'] is False


def test_both_mode_sends_eagle_then_demi(app, monkeypatch, cp_env):
    """Mode both PUTs to Eagle first, then to DEMI."""
    _set_target(app, monkeypatch, 'both')
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)
    mock_rest.put.return_value = _response()

    ProjectService.update_project_info(1)

    endpoints = [c.kwargs['endpoint'] for c in mock_rest.put.call_args_list]
    assert endpoints == [
        f'https://eagle-dev/api/commentperiod/{TRACKING_ID}',
        f'{DEMI_URL}/engage/engagements/1',
    ]


def test_demi_mode_stores_eagle_id_as_tracking_id(app, monkeypatch, cp_env):
    """The eagleId in the DEMI response fills an empty tracking id."""
    _set_target(app, monkeypatch, 'demi')
    mock_meta_model, mock_rest = cp_env
    meta = _make_metadata(tracking_id=None)
    mock_meta_model.find_by_engagement_id.return_value = meta
    mock_rest.put.return_value = _response(body={'eagleId': EAGLE_ID})

    ProjectService.update_project_info(1)

    assert meta.project_tracking_id == EAGLE_ID
    meta.commit.assert_called_once()


@pytest.mark.parametrize('status, code, level, expected_ok', [
    (HTTPStatus.NOT_FOUND, 'PARENT_NOT_FOUND', 'ERROR', False),
    (HTTPStatus.CONFLICT, 'STALE_PUSH', 'WARNING', True),  # DEMI already holds this push or a newer one
    (HTTPStatus.CONFLICT, 'OTHER', 'ERROR', False),
    (HTTPStatus.CONFLICT, None, 'ERROR', False),
    (HTTPStatus.UNPROCESSABLE_ENTITY, 'TRACKING_ID_CLAIMED', 'ERROR', False),
    (HTTPStatus.INTERNAL_SERVER_ERROR, 'STALE_PUSH', 'ERROR', False),
])
def test_demi_mode_logs_refused_put(app, monkeypatch, cp_env, caplog, status, code, level, expected_ok):
    """Only a 409 STALE_PUSH is a warning and counts as success; every other refusal is an error."""
    _set_target(app, monkeypatch, 'demi')
    mock_meta_model, mock_rest = cp_env
    meta = _make_metadata(tracking_id=None)
    mock_meta_model.find_by_engagement_id.return_value = meta
    body = {'code': code, 'eagleId': EAGLE_ID} if code else None
    mock_rest.put.return_value = _response(status, body=body, text='refused')
    if code is None:
        mock_rest.put.return_value.json.side_effect = ValueError('no JSON')

    assert ProjectService.update_project_info(1) is expected_ok

    records = [r for r in caplog.records if r.levelno >= logging.WARNING]
    assert [r.levelname for r in records] == [level]
    message = records[0].getMessage()
    assert 'engage/engagements/1' in message
    if expected_ok:
        assert 'already current' in message and 'failed' not in message
    else:
        assert f'status={status.value}' in message and 'failed' in message
    assert meta.project_tracking_id is None


def test_demi_empty_success_body_is_success(app, monkeypatch, cp_env, caplog):
    """A 2xx DEMI response with no body counts as success and leaves the tracking id alone."""
    _set_target(app, monkeypatch, 'demi')
    mock_meta_model, mock_rest = cp_env
    meta = _make_metadata(tracking_id=None)
    mock_meta_model.find_by_engagement_id.return_value = meta
    response = _response(HTTPStatus.NO_CONTENT)
    response.json.side_effect = ValueError('no JSON')
    mock_rest.put.return_value = response

    assert ProjectService.update_project_info(1) is True

    assert meta.project_tracking_id is None
    meta.commit.assert_not_called()
    assert not [r for r in caplog.records if r.levelno >= logging.WARNING]


def test_demi_mode_delete_sends_tombstone(app, monkeypatch, cp_env):
    """Delete in demi mode PUTs isDeleted true to DEMI and does not call Eagle."""
    _set_target(app, monkeypatch, 'demi')
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=None)
    mock_rest.put.return_value = _response()

    ProjectService.delete_from_epic(1)

    mock_rest.delete.assert_not_called()
    kwargs = mock_rest.put.call_args.kwargs
    assert kwargs['endpoint'] == f'{DEMI_URL}/engage/engagements/1'
    assert kwargs['data']['engagement']['isDeleted'] is True


def test_both_mode_delete_hits_eagle_and_demi(app, monkeypatch, cp_env):
    """Delete in both mode keeps the Eagle DELETE and adds the DEMI tombstone."""
    _set_target(app, monkeypatch, 'both')
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)
    mock_rest.delete.return_value = _response()
    mock_rest.put.return_value = _response()

    ProjectService.delete_from_epic(1)

    mock_rest.delete.assert_called_once()
    assert mock_rest.put.call_args.kwargs['data']['engagement']['isDeleted'] is True


def test_demi_mode_notification_stays_on_eagle(app, monkeypatch):
    """Project notifications still go to Eagle in demi mode."""
    monkeypatch.setitem(app.config, 'IS_EAO_ENVIRONMENT', True)
    monkeypatch.setitem(app.config, 'EPIC_URL', 'https://eagle-dev/api/commentperiod')
    monkeypatch.setitem(app.config, 'DEMI_API_URL', DEMI_URL)
    _set_target(app, monkeypatch, 'demi')
    with app.app_context(), \
            patch('met_api.services.project_service.EngagementModel') as mock_eng_model, \
            patch('met_api.services.project_service.EngagementMetadataModel') as mock_meta_model, \
            patch.object(ProjectService, '_get_project_type', return_value='notification'), \
            patch.object(ProjectService, '_get_eao_service_account_token', return_value='token'), \
            patch('met_api.services.project_service.notification'), \
            patch('met_api.services.project_service.EmailVerificationService'), \
            patch('met_api.services.project_service.requests.get') as mock_get, \
            patch('met_api.services.project_service.RestService') as mock_rest:
        mock_eng_model.find_by_id.return_value = _make_engagement()
        mock_meta_model.find_by_engagement_id.return_value = _make_metadata()
        mock_get.return_value = _response(body={'_id': PROJECT_ID})
        mock_rest.put.return_value = _response()

        ProjectService.update_project_info(1)

        mock_rest.put.assert_called_once()
        assert mock_rest.put.call_args.kwargs['endpoint'].startswith(
            'https://eagle-dev/api/projectNotification/abc123projectid'
        )


def test_both_mode_eagle_exception_still_sends_demi(app, monkeypatch, cp_env):
    """An exception on the Eagle leg is reported but the DEMI PUT still goes out."""
    _set_target(app, monkeypatch, 'both')
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)
    mock_rest.put.side_effect = [RuntimeError('eagle down'), _response()]

    assert ProjectService.update_project_info(1) is False

    assert [c.kwargs['endpoint'] for c in mock_rest.put.call_args_list] == [
        f'https://eagle-dev/api/commentperiod/{TRACKING_ID}',
        f'{DEMI_URL}/engage/engagements/1',
    ]


def test_both_mode_new_eagle_id_reaches_demi(app, monkeypatch, cp_env):
    """The Eagle POST's new id goes to DEMI as trackingId in the same run; DEMI's eagleId does not replace it."""
    _set_target(app, monkeypatch, 'both')
    mock_meta_model, mock_rest = cp_env
    meta = _make_metadata(tracking_id=None)
    mock_meta_model.find_by_engagement_id.return_value = meta
    mock_rest.post.return_value = _response(body={'_id': TRACKING_ID})
    mock_rest.put.return_value = _response(body={'eagleId': EAGLE_ID})

    assert ProjectService.update_project_info(1) is True

    assert mock_rest.put.call_args.kwargs['data']['engagement']['trackingId'] == TRACKING_ID
    assert meta.project_tracking_id == TRACKING_ID
    meta.commit.assert_called_once()


def test_demi_key_never_logged_on_success(app, monkeypatch, push_env, caplog):
    """Through the real RestService at DEBUG, the subscription key is sent but never logged."""
    _set_target(app, monkeypatch, 'both')
    caplog.set_level(logging.DEBUG)
    monkeypatch.setattr(app.logger, 'disabled', False)
    push_env.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)
    ok = _response()
    ok.headers = {}

    with patch('met_api.services.rest_service.requests.put', return_value=ok) as mock_put:
        assert ProjectService.update_project_info(1) is True

    assert mock_put.call_args.kwargs['headers']['Ocp-Apim-Subscription-Key'] == DEMI_KEY
    assert f'{DEMI_URL}/engage/engagements/1' in caplog.text  # RestService's debug lines were captured
    assert DEMI_KEY not in caplog.text


def test_demi_invalid_key_logs_class_name_only(app, monkeypatch, push_env, caplog):
    """A key that is not a valid header value fails the push without its text reaching the log."""
    _set_target(app, monkeypatch, 'demi')
    caplog.set_level(logging.DEBUG)
    monkeypatch.setattr(app.logger, 'disabled', False)
    # requests refuses a header value with an inner line break before any network call.
    monkeypatch.setitem(app.config, 'DEMI_API_KEY', f'{DEMI_KEY}\nX-Extra: 1')
    push_env.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)

    with patch('requests.Session.send') as send:
        assert ProjectService.update_project_info(1) is False

    send.assert_not_called()
    assert 'InvalidHeader' in caplog.text
    assert DEMI_KEY not in caplog.text


def test_demi_url_unset_skips_demi(app, monkeypatch, cp_env, caplog):
    """Without DEMI_API_URL the DEMI leg logs an error and sends nothing."""
    _set_target(app, monkeypatch, 'demi')
    monkeypatch.setitem(app.config, 'DEMI_API_URL', '')
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)

    assert ProjectService.update_project_info(1) is False

    mock_rest.put.assert_not_called()
    assert 'DEMI_API_URL is not set' in caplog.text


@pytest.mark.parametrize('raw, expected', [
    (' DEMI ', (False, True)),
    ('Both', (True, True)),
    ('', (True, False)),
])
def test_sync_targets_normalised(app, monkeypatch, raw, expected):
    """Case and whitespace in EPIC_SYNC_TARGET do not change the target."""
    _set_target(app, monkeypatch, raw)
    with app.app_context():
        assert project_service._sync_targets() == expected


def test_unknown_sync_target_warns_once_and_uses_eagle(app, monkeypatch, caplog):
    """An unknown target falls back to Eagle only and is warned about once, not on every push."""
    monkeypatch.setattr(project_service.logger, 'disabled', False)
    monkeypatch.setattr(project_service, '_warned_sync_targets', set())
    _set_target(app, monkeypatch, 'demo')
    with app.app_context():
        assert project_service._sync_targets() == (True, False)
        assert project_service._sync_targets() == (True, False)

    warnings = [r.getMessage() for r in caplog.records if r.levelname == 'WARNING']
    assert len(warnings) == 1 and 'demo' in warnings[0]


@pytest.mark.parametrize('call', [ProjectService.update_project_info, ProjectService.delete_from_epic])
def test_epic_url_unset_skips_with_error(app, monkeypatch, cp_env, caplog, call):
    """Without EPIC_URL nothing is looked up or sent, in any target, and the skip is an error."""
    _set_target(app, monkeypatch, 'demi')
    monkeypatch.setitem(app.config, 'EPIC_URL', None)
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)

    with patch.object(ProjectService, '_get_eao_service_account_token') as token:
        assert call(1) is False

    token.assert_not_called()
    mock_rest.put.assert_not_called()
    mock_rest.delete.assert_not_called()
    assert 'EPIC_URL is not set' in next(r.getMessage() for r in caplog.records if r.levelname == 'ERROR')


@pytest.mark.parametrize('status, level', [(HTTPStatus.NOT_FOUND, 'WARNING'), (HTTPStatus.BAD_GATEWAY, 'ERROR')])
def test_eagle_delete_failure_level(cp_env, caplog, status, level):
    """An Eagle DELETE of a period already gone is a warning; any other failure is an error."""
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)
    mock_rest.delete.return_value = _response(status)

    assert ProjectService.delete_from_epic(1) is False

    records = [r for r in caplog.records if r.levelno >= logging.WARNING]
    assert [r.levelname for r in records] == [level]
    assert f'DELETE https://eagle-dev/api/commentperiod/{TRACKING_ID}' in records[0].getMessage()


@pytest.mark.parametrize('status, level', [(HTTPStatus.NOT_FOUND, 'WARNING'), (HTTPStatus.BAD_GATEWAY, 'ERROR')])
def test_notification_put_failure_level(cp_env, caplog, status, level):
    """A notification PUT that finds nothing is a warning; any other failure is an error."""
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=PROJECT_ID)
    mock_rest.put.return_value = _response(status)

    with patch.object(ProjectService, '_get_project_type', return_value='notification'), \
            patch('met_api.services.project_service.notification'), \
            patch('met_api.services.project_service.EmailVerificationService'), \
            patch('met_api.services.project_service.requests.get', return_value=_response(body={'_id': PROJECT_ID})):
        assert ProjectService.update_project_info(1) is False

    records = [r for r in caplog.records if r.levelno >= logging.WARNING]
    assert [r.levelname for r in records] == [level]
    assert 'PUT https://eagle-dev/api/projectNotification/' in records[0].getMessage()


def test_project_type_lookup_exceptions_log_warnings(app, monkeypatch, caplog):
    """Failed project and notification lookups are each logged as a warning, then default to project."""
    monkeypatch.setattr(project_service.logger, 'disabled', False)
    monkeypatch.setitem(app.config, 'EPIC_URL', 'https://eagle-dev/api/commentperiod')
    with app.app_context(), \
            patch('met_api.services.project_service.requests.get',
                  side_effect=requests.ConnectionError('unreachable')):
        assert ProjectService._get_project_type(PROJECT_ID, 'token') == 'project'

    warnings = [r.getMessage() for r in caplog.records if r.levelname == 'WARNING']
    assert len(warnings) == 2
    assert f'https://eagle-dev/api/project/{PROJECT_ID}' in warnings[0] and 'unreachable' in warnings[0]
    assert f'https://eagle-dev/api/projectNotification/{PROJECT_ID}' in warnings[1]


@pytest.fixture
def reload_config(monkeypatch):
    """Re-import met_api.config with the given variables and no .env file, then restore it."""
    def _load(**env):
        for key, value in env.items():
            monkeypatch.setenv(key, value)
        with patch('dotenv.load_dotenv'):
            return reload(met_config)

    yield _load
    monkeypatch.undo()
    reload(met_config)


def test_config_strips_sync_values(reload_config):
    """Sync target is case and whitespace insensitive; URL and key lose stray whitespace from secrets."""
    cfg = reload_config(EPIC_SYNC_TARGET=' Both\n', DEMI_API_URL=' https://demi.test/api \n',
                        DEMI_API_KEY='  key-value\n')._Config

    assert cfg.EPIC_SYNC_TARGET == 'both'
    assert cfg.DEMI_API_URL == 'https://demi.test/api'
    assert cfg.DEMI_API_KEY == 'key-value'


def test_demi_only_targets_skip_eagle_in_both_mode(app, monkeypatch, cp_env):
    """An explicit DEMI-only call sends nothing to Eagle even when the config says both."""
    _set_target(app, monkeypatch, 'both')
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=None)
    mock_rest.put.return_value = _response()

    assert ProjectService.update_project_info(1, targets=('demi',)) is True

    mock_rest.post.assert_not_called()
    assert [c.kwargs['endpoint'] for c in mock_rest.put.call_args_list] == [f'{DEMI_URL}/engage/engagements/1']


def test_demi_only_targets_skip_notification(app, monkeypatch, cp_env):
    """A project notification is left alone, and reported as None, by an explicit DEMI-only call."""
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata()

    with patch.object(ProjectService, '_get_project_type', return_value='notification'), \
            patch('met_api.services.project_service.requests.get') as mock_get:
        assert ProjectService.update_project_info(1, targets=('demi',)) is None

    mock_get.assert_not_called()
    mock_rest.put.assert_not_called()


def test_demi_key_unset_skips_demi(app, monkeypatch, cp_env, caplog):
    """Without DEMI_API_KEY the DEMI leg logs an error and sends nothing."""
    _set_target(app, monkeypatch, 'demi')
    monkeypatch.setitem(app.config, 'DEMI_API_KEY', '')
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)

    assert ProjectService.update_project_info(1) is False

    mock_rest.put.assert_not_called()
    assert 'DEMI_API_KEY is not set' in next(r.getMessage() for r in caplog.records if r.levelname == 'ERROR')


def test_demi_non_json_success_body_is_success(app, monkeypatch, cp_env, caplog):
    """A 2xx DEMI response whose body is not JSON counts as sent, with no Eagle id taken from it."""
    _set_target(app, monkeypatch, 'demi')
    mock_meta_model, mock_rest = cp_env
    meta = _make_metadata(tracking_id=None)
    mock_meta_model.find_by_engagement_id.return_value = meta
    response = _response()
    response.content = b'<html>ok</html>'
    response.json.side_effect = ValueError('not JSON')
    mock_rest.put.return_value = response

    assert ProjectService.update_project_info(1) is True

    assert meta.project_tracking_id is None
    assert not [r for r in caplog.records if r.levelno >= logging.WARNING]


def test_demi_payload_sends_null_for_missing_dates(payload_env):
    """DEMI gets null start and end when the engagement has no dates."""
    eng = _dated_engagement()
    eng.start_date = None
    eng.end_date = None

    engagement = ProjectService._construct_demi_payload(eng, _make_metadata())['engagement']

    assert engagement['start'] is None and engagement['end'] is None


def test_delete_from_epic_exception_rolls_back(cp_env, caplog):
    """An exception in delete_from_epic is swallowed, rolled back and reported as a failure."""
    mock_meta_model, _ = cp_env
    mock_meta_model.find_by_engagement_id.side_effect = RuntimeError('db down')

    with patch('met_api.services.project_service.db') as mock_db:
        assert ProjectService.delete_from_epic(4) is False

    mock_db.session.rollback.assert_called_once()
    assert 'engagement_id=4' in next(r.getMessage() for r in caplog.records if r.levelname == 'ERROR')


def test_both_mode_delete_eagle_exception_still_sends_tombstone(app, monkeypatch, cp_env):
    """An exception on the Eagle DELETE is reported but the DEMI tombstone still goes out."""
    _set_target(app, monkeypatch, 'both')
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=TRACKING_ID)
    mock_rest.delete.side_effect = RuntimeError('eagle down')
    mock_rest.put.return_value = _response()

    assert ProjectService.delete_from_epic(1) is False

    kwargs = mock_rest.put.call_args.kwargs
    assert kwargs['endpoint'] == f'{DEMI_URL}/engage/engagements/1'
    assert kwargs['data']['engagement']['isDeleted'] is True


@pytest.mark.parametrize('get_status, put_status, level', [
    (HTTPStatus.NOT_FOUND, None, 'WARNING'),
    (HTTPStatus.BAD_GATEWAY, None, 'ERROR'),
    (HTTPStatus.OK, HTTPStatus.NOT_FOUND, 'WARNING'),
    (HTTPStatus.OK, HTTPStatus.BAD_GATEWAY, 'ERROR'),
])
def test_delete_notification_failure(cp_env, caplog, get_status, put_status, level):
    """A failed notification GET or PUT on delete fails the call; 404 is a warning, the rest errors."""
    mock_meta_model, mock_rest = cp_env
    mock_meta_model.find_by_engagement_id.return_value = _make_metadata(tracking_id=PROJECT_ID)
    mock_rest.put.return_value = _response(put_status) if put_status else _response()

    with patch.object(ProjectService, '_get_project_type', return_value='notification'), \
            patch('met_api.services.project_service.requests.get',
                  return_value=_response(get_status, body={'_id': PROJECT_ID})):
        assert ProjectService.delete_from_epic(1) is False

    assert [r.levelname for r in caplog.records if r.levelno >= logging.WARNING] == [level]
    if put_status is None:
        mock_rest.put.assert_not_called()

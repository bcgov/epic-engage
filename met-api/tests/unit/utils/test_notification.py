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

"""Tests to assure the Notification utilities.

Test-Suite to ensure that the Notification methods are working as expected.
"""

import json
from unittest.mock import MagicMock, patch

import pytest

from met_api.utils import notification

EAGLE_NOTIFY_URL = 'https://eagle-notify.example.com/api/messages'
NOTIFY_API_URL = 'https://notify-api.example.com/api/v1/notifications/email'
EPIC_ISSUER = 'https://epic-kc.example.com/auth/realms/eao-epic'
MET_ISSUER = 'https://met-kc.example.com/auth/realms/met'


@pytest.mark.parametrize('test_input_email,expected',
                         [('helo@gw.com', True), ('helo', False), (None, False), ('', False)])
def test_is_valid_email(test_input_email, expected):
    """Assert that the valid email method works well.."""
    assert notification.is_valid_email(test_input_email) == expected


def _token_response(token):
    response = MagicMock()
    response.json.return_value = {'access_token': token}
    return response


@pytest.fixture
def mail_config(app, monkeypatch):
    """Point both send paths at fake hosts and give each its own credentials."""
    for key, value in {
        'NOTIFICATIONS_EMAIL_ENDPOINT': NOTIFY_API_URL,
        'MAIL_FROM_ID': 'sender@example.com',
        'KEYCLOAK_SERVICE_ACCOUNT_ID': 'met-admin',
        'KEYCLOAK_SERVICE_ACCOUNT_SECRET': 'met-admin-pw',
        'JWT_OIDC_ISSUER': MET_ISSUER,
        'EPIC_KEYCLOAK_SERVICE_ACCOUNT_ID': 'epic-user',
        'EPIC_KEYCLOAK_SERVICE_ACCOUNT_SECRET': 'epic-pw',
        'EPIC_KC_CLIENT_ID': 'epic-client',
        'EPIC_JWT_OIDC_ISSUER': EPIC_ISSUER,
    }.items():
        monkeypatch.setitem(app.config, key, value)
    return app


def _send(app):
    with app.app_context(), patch('requests.post') as mock_post:
        mock_post.side_effect = [_token_response('tok-1'), MagicMock()]
        notification.send_email('Subject', 'person@example.com', '<p>hi</p>', {'a': 1}, 'tpl-1', reference=7)
    return mock_post.call_args_list


def _assert_mail_call(mail_call, url):
    args, kwargs = mail_call
    assert args[0] == url
    assert kwargs['headers']['Authorization'] == 'Bearer tok-1'
    assert json.loads(kwargs['data']) == {
        'bodyType': 'html',
        'body': '<p>hi</p>',
        'from': 'sender@example.com',
        'subject': 'Subject',
        'to': ['person@example.com'],
        'args': {'a': 1},
        'template_id': 'tpl-1',
        'reference': '7',
    }


def test_send_email_uses_eagle_notify_when_configured(mail_config, monkeypatch):
    """With the eagle-notify endpoint set, mail is signed by the EPIC account and sent there."""
    monkeypatch.setitem(mail_config.config, 'EAGLE_NOTIFY_EMAIL_ENDPOINT', EAGLE_NOTIFY_URL)

    token_call, mail_call = _send(mail_config)

    args, kwargs = token_call
    assert args[0] == EPIC_ISSUER + '/protocol/openid-connect/token'
    assert kwargs['data'] == {
        'username': 'epic-user',
        'password': 'epic-pw',
        'grant_type': 'password',
        'client_id': 'epic-client',
    }
    _assert_mail_call(mail_call, EAGLE_NOTIFY_URL)


def test_send_email_uses_notify_api_when_endpoint_empty(mail_config, monkeypatch):
    """With the eagle-notify endpoint empty, mail goes to notify-api with the MET admin token."""
    monkeypatch.setitem(mail_config.config, 'EAGLE_NOTIFY_EMAIL_ENDPOINT', '')

    token_call, mail_call = _send(mail_config)

    args, kwargs = token_call
    assert args[0] == MET_ISSUER + '/protocol/openid-connect/token'
    assert kwargs['auth'] == ('met-admin', 'met-admin-pw')
    assert kwargs['data'] == 'grant_type=client_credentials'
    _assert_mail_call(mail_call, NOTIFY_API_URL)

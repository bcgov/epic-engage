"""The jobs build their own Flask config, so the EPIC push only happens if that config carries the EPIC keys."""
import importlib
from unittest.mock import MagicMock, patch

from flask import Flask
import pytest

import config
from met_api.services.project_service import ProjectService


EPIC_ENV = {
    'IS_EAO_ENVIRONMENT': 'True',
    'EPIC_URL': 'https://eagle.example/api/commentperiod',
    'EPIC_MILESTONE': 'milestone-1',
    'EPIC_KC_CLIENT_ID': 'eagle-client',
    'EPIC_KEYCLOAK_SERVICE_ACCOUNT_ID': 'engage-sa',
    'EPIC_KEYCLOAK_SERVICE_ACCOUNT_SECRET': 'not-a-real-value',
    'EPIC_JWT_OIDC_ISSUER': 'https://login.example/auth/realms/eao-epic',
}


@pytest.fixture
def load_config(monkeypatch):
    """Re-import config with only the given EPIC variables set, and restore it afterwards."""
    def _load(**env):
        for key in EPIC_ENV:
            monkeypatch.delenv(key, raising=False)
        for key, value in env.items():
            monkeypatch.setenv(key, value)
        # A local .env would otherwise fill the variables this test removed.
        with patch('dotenv.load_dotenv'):
            return importlib.reload(config)

    yield _load
    monkeypatch.undo()
    importlib.reload(config)


def _app(cfg):
    app = Flask(__name__)
    app.config.from_object(cfg.TestConfig)
    return app


def test_epic_keys_default_when_unset(load_config):
    """With nothing set, the EPIC push stays off."""
    cfg = load_config()._Config

    assert cfg.IS_EAO_ENVIRONMENT is False
    assert cfg.EPIC_URL is None
    assert cfg.EPIC_KEYCLOAK_SERVICE_ACCOUNT_ID is None


def test_epic_keys_read_from_env(load_config):
    """Every EPIC variable reaches the config the jobs run with."""
    cfg = load_config(**EPIC_ENV)._Config

    assert cfg.IS_EAO_ENVIRONMENT is True
    for key, value in EPIC_ENV.items():
        if key != 'IS_EAO_ENVIRONMENT':
            assert getattr(cfg, key) == value, key


@pytest.mark.parametrize('raw, expected', [('true', True), ('TRUE', True), ('False', False), ('yes', False)])
def test_is_eao_environment_needs_true(load_config, raw, expected):
    """Only the word true, in any case, turns the EPIC push on, matching met-api."""
    assert load_config(IS_EAO_ENVIRONMENT=raw)._Config.IS_EAO_ENVIRONMENT is expected


def _push(app):
    """Run update_project_info for a linked engagement with storage and HTTP patched out."""
    metadata = MagicMock(project_id='proj-1', project_tracking_id='cp-1')
    with app.app_context(), \
            patch('met_api.services.project_service.EngagementModel') as engagement_model, \
            patch('met_api.services.project_service.EngagementMetadataModel') as metadata_model, \
            patch.object(ProjectService, '_get_project_type', return_value='project'), \
            patch.object(ProjectService, '_construct_epic_payload', return_value={'isMet': True}), \
            patch('met_api.services.project_service.RestService') as rest:
        engagement_model.find_by_id.return_value = MagicMock(id=1)
        metadata_model.find_by_engagement_id.return_value = metadata
        rest.get_access_token_with_password.return_value = 'token'
        ProjectService.update_project_info(1)
    return rest


def test_update_project_info_puts_with_job_config(load_config):
    """With the EPIC variables set, a job's app sends the PUT using the service account from its config."""
    rest = _push(_app(load_config(**EPIC_ENV)))

    rest.get_access_token_with_password.assert_called_once_with(
        'engage-sa', 'not-a-real-value', 'eagle-client', 'https://login.example/auth/realms/eao-epic')
    rest.put.assert_called_once_with(endpoint='https://eagle.example/api/commentperiod/cp-1', token='token',
                                     data={'isMet': True}, raise_for_status=False)


def test_update_project_info_skips_without_eao_flag(load_config):
    """Without IS_EAO_ENVIRONMENT the push is skipped before any HTTP call."""
    env = {key: value for key, value in EPIC_ENV.items() if key != 'IS_EAO_ENVIRONMENT'}
    rest = _push(_app(load_config(**env)))

    rest.get_access_token_with_password.assert_not_called()
    rest.put.assert_not_called()

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
    'DEMI_API_URL': 'https://demi.example/api',
    'DEMI_API_KEY': 'not-a-real-key',
    'EPIC_SYNC_TARGET': 'both',
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
    """With nothing set, the EPIC push stays off and the DEMI keys fall back to met-api's defaults."""
    cfg = load_config()._Config

    assert cfg.IS_EAO_ENVIRONMENT is False
    assert cfg.EPIC_URL is None
    assert cfg.EPIC_KEYCLOAK_SERVICE_ACCOUNT_ID is None
    assert cfg.DEMI_API_URL == ''
    assert cfg.DEMI_API_KEY == ''
    assert cfg.EPIC_SYNC_TARGET == 'eagle'


def test_epic_keys_read_from_env(load_config):
    """Every EPIC and DEMI variable reaches the config the jobs run with."""
    cfg = load_config(**EPIC_ENV)._Config

    assert cfg.IS_EAO_ENVIRONMENT is True
    for key, value in EPIC_ENV.items():
        if key != 'IS_EAO_ENVIRONMENT':
            assert getattr(cfg, key) == value, key


def test_sync_values_stripped(load_config):
    """Sync target is case and whitespace insensitive; URL and key lose stray whitespace from secrets."""
    cfg = load_config(EPIC_SYNC_TARGET=' Demi\n', DEMI_API_URL=' https://demi.example/api\n',
                      DEMI_API_KEY='  key-value\n')._Config

    assert cfg.EPIC_SYNC_TARGET == 'demi'
    assert cfg.DEMI_API_URL == 'https://demi.example/api'
    assert cfg.DEMI_API_KEY == 'key-value'


@pytest.mark.parametrize('raw, expected', [('true', True), ('TRUE', True), ('False', False), ('yes', False)])
def test_is_eao_environment_needs_true(load_config, raw, expected):
    """Only the word true, in any case, turns the EPIC push on, matching met-api."""
    assert load_config(IS_EAO_ENVIRONMENT=raw)._Config.IS_EAO_ENVIRONMENT is expected


def _push(app):
    """Run update_project_info for a linked engagement with storage, payload fields and HTTP patched out."""
    metadata = MagicMock(project_id='proj-1', project_tracking_id='cp-1', updated_date=None)
    with app.app_context(), \
            patch('met_api.services.project_service.EngagementModel') as engagement_model, \
            patch('met_api.services.project_service.EngagementMetadataModel') as metadata_model, \
            patch.object(ProjectService, '_get_project_type', return_value='project'), \
            patch.object(ProjectService, '_construct_epic_payload', return_value={'isMet': True}), \
            patch.object(ProjectService, '_engagement_fields', return_value={'isPublished': True}), \
            patch('met_api.services.project_service.RestService') as rest:
        engagement_model.find_by_id.return_value = MagicMock(id=1, updated_date=None)
        metadata_model.find_by_engagement_id.return_value = metadata
        rest.get_access_token_with_password.return_value = 'token'
        rest.put.return_value = MagicMock(status_code=200, content=b'')
        ok = ProjectService.update_project_info(1)
    return rest, ok


def test_update_project_info_puts_with_job_config(load_config):
    """With the EPIC variables set, a job's app sends the Eagle PUT using the service account from its config."""
    rest, ok = _push(_app(load_config(**{**EPIC_ENV, 'EPIC_SYNC_TARGET': 'eagle'})))

    assert ok is True
    rest.get_access_token_with_password.assert_called_once_with(
        'engage-sa', 'not-a-real-value', 'eagle-client', 'https://login.example/auth/realms/eao-epic')
    rest.put.assert_called_once_with(endpoint='https://eagle.example/api/commentperiod/cp-1', token='token',
                                     data={'isMet': True}, raise_for_status=False)


def test_update_project_info_both_mode_puts_eagle_and_demi(load_config):
    """In both mode a job's app sends the Eagle PUT, then the DEMI PUT with the key from its config."""
    rest, ok = _push(_app(load_config(**EPIC_ENV)))

    assert ok is True
    eagle, demi = rest.put.call_args_list
    assert eagle.kwargs['endpoint'] == 'https://eagle.example/api/commentperiod/cp-1'
    assert demi.kwargs['endpoint'] == 'https://demi.example/api/engage/engagements/1'
    assert demi.kwargs['additional_headers'] == {'Ocp-Apim-Subscription-Key': 'not-a-real-key'}


def test_update_project_info_skips_without_eao_flag(load_config):
    """Without IS_EAO_ENVIRONMENT the push is skipped before any HTTP call."""
    env = {key: value for key, value in EPIC_ENV.items() if key != 'IS_EAO_ENVIRONMENT'}
    rest, _ = _push(_app(load_config(**env)))

    rest.get_access_token_with_password.assert_not_called()
    rest.put.assert_not_called()

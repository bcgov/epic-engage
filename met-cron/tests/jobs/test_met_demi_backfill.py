"""Checks for the manual job that re-pushes every EPIC-linked engagement to DEMI."""
from unittest.mock import MagicMock, call, patch

from flask import Flask
import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Query

import config
from met_api.models import db
from met_api.services.project_service import ProjectService
from tasks.met_demi_backfill import MetDemiBackfill


@pytest.fixture
def app():
    """Bare app with the job config, DEMI sync on and the shared db bound, no database connection made."""
    app = Flask(__name__)
    app.config.from_object(config.TestConfig)
    app.config.update(IS_EAO_ENVIRONMENT=True, EPIC_SYNC_TARGET='demi',
                      EPIC_URL='https://eagle.example/api/commentperiod', DEMI_API_URL='https://demi.example/api',
                      DEMI_API_KEY='not-a-real-key')
    db.init_app(app)
    return app


def _response(status):
    return MagicMock(status_code=status, content=b'', text='')


def test_selects_linked_engagements_public_or_pushed_unpublished(app, monkeypatch):
    """Published, Closed and Scheduled engagements with a project id, plus Unpublished ones already pushed."""
    captured = []
    monkeypatch.setattr(Query, 'all', lambda query: captured.append(query) or [])

    with app.app_context():
        assert MetDemiBackfill._engagement_ids() == []  # pylint: disable=protected-access

    sql = ' '.join(str(captured[0].statement.compile(dialect=postgresql.dialect(),
                                                     compile_kwargs={'literal_binds': True})).split())
    assert 'engagement_metadata.project_id IS NOT NULL' in sql
    assert "engagement_metadata.project_id != ''" in sql
    assert ('engagement.status_id IN (2, 4, 3) OR engagement.status_id = 5 '
            'AND engagement_metadata.project_tracking_id IS NOT NULL '
            "AND engagement_metadata.project_tracking_id != ''") in sql


@pytest.fixture
def push_env(app):
    """Run the real update_project_info with models, lookups and HTTP patched; yields the RestService mock."""
    with app.app_context(), \
            patch('met_api.services.project_service.EngagementModel') as engagement_model, \
            patch('met_api.services.project_service.EngagementMetadataModel') as metadata_model, \
            patch.object(ProjectService, '_get_eao_service_account_token', return_value='token'), \
            patch.object(ProjectService, '_engagement_fields', return_value={}), \
            patch('met_api.services.project_service.RestService') as rest:
        engagement_model.find_by_id.side_effect = lambda eng_id: MagicMock(id=eng_id, updated_date=None)
        metadata_model.find_by_engagement_id.return_value = MagicMock(
            project_id='proj-1', project_tracking_id='cp-1', updated_date=None)
        yield rest


def test_failed_push_is_counted_and_fails_the_run(app, monkeypatch, push_env):
    """A DEMI 500 for one engagement is counted as failed; the rest still go, and the run ends failed."""
    monkeypatch.setattr(MetDemiBackfill, '_engagement_ids', staticmethod(lambda: [11, 12, 13]))
    push_env.put.side_effect = lambda **kwargs: _response(500 if kwargs['endpoint'].endswith('/12') else 200)

    with patch.object(ProjectService, '_get_project_type', return_value='project'), \
            patch.object(app.logger, 'info') as info:
        with pytest.raises(RuntimeError, match=r'\[12\]'):
            MetDemiBackfill.do_backfill()

    assert [c.kwargs['endpoint'] for c in push_env.put.call_args_list] == [
        f'https://demi.example/api/engage/engagements/{eng_id}' for eng_id in (11, 12, 13)]
    assert info.call_args.args[1:] == (3, 2, 1, [12], 0)


def test_both_mode_sends_only_demi_and_skips_notifications(app, monkeypatch, push_env):
    """In both mode the job never writes to Eagle, and a notification-linked engagement is counted as skipped."""
    app.config['EPIC_SYNC_TARGET'] = 'both'
    monkeypatch.setattr(MetDemiBackfill, '_engagement_ids', staticmethod(lambda: [41, 42]))
    push_env.put.return_value = _response(200)

    with patch.object(ProjectService, '_get_project_type', side_effect=['project', 'notification']), \
            patch('met_api.services.project_service.requests') as http, \
            patch.object(app.logger, 'info') as info:
        MetDemiBackfill.do_backfill()

    push_env.post.assert_not_called()
    push_env.delete.assert_not_called()
    http.get.assert_not_called()
    assert [c.kwargs['endpoint'] for c in push_env.put.call_args_list] == [
        'https://demi.example/api/engage/engagements/41']
    assert info.call_args.args[1:] == (2, 1, 0, [], 1)


def test_clean_run_pushes_all(app, monkeypatch):
    """With no failures every selected engagement is pushed once, DEMI only, and the run succeeds."""
    monkeypatch.setattr(MetDemiBackfill, '_engagement_ids', staticmethod(lambda: [21, 22]))

    with app.app_context(), \
            patch.object(ProjectService, 'update_project_info', return_value=True) as push:
        MetDemiBackfill.do_backfill()

    assert push.call_args_list == [call(21, targets=('demi',)), call(22, targets=('demi',))]


@pytest.mark.parametrize('settings', [{'EPIC_SYNC_TARGET': 'eagle'}, {'IS_EAO_ENVIRONMENT': False}])
def test_refuses_without_demi_target(app, monkeypatch, settings):
    """In eagle mode, or with the EPIC push off, the job logs an error and fails without pushing anything."""
    app.config.update(settings)
    monkeypatch.setattr(MetDemiBackfill, '_engagement_ids', staticmethod(lambda: [31]))

    with app.app_context(), \
            patch.object(ProjectService, 'update_project_info') as push, \
            patch.object(app.logger, 'error') as error:
        with pytest.raises(RuntimeError, match='refused'):
            MetDemiBackfill.do_backfill()

    push.assert_not_called()
    error.assert_called_once()

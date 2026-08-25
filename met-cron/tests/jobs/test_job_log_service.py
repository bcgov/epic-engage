"""Checks for scheduled job run logging and redaction."""
from flask import Flask
import pytest

from met_cron.services.job_log_service import JobLogService
from met_cron.utils.scrub import scrub_sensitive


PARTICIPANT_ERROR = (
    '(psycopg2.errors.UniqueViolation) duplicate key\n'
    '[SQL: INSERT INTO submission (id, comment) VALUES (%(id)s, %(comment)s)]\n'
    "[parameters: {'id': 4471, 'comment': 'this project is a disaster', "
    "'email': 'participant@example.com'}]"
)


def test_scrub_drops_sql_parameters_and_emails():
    """Submission ids, comment text, and emails must not survive scrubbing."""
    scrubbed = scrub_sensitive(PARTICIPANT_ERROR)

    assert 'UniqueViolation' in scrubbed, 'the diagnostic part has to be kept'
    assert '4471' not in scrubbed
    assert 'this project is a disaster' not in scrubbed
    assert 'participant@example.com' not in scrubbed


def test_scrub_keeps_both_ends_when_trimming():
    """A trimmed traceback keeps its call site and its exception message."""
    scrubbed = scrub_sensitive('HEAD' + ('x' * 500) + 'TAIL', max_chars=100)

    assert scrubbed.startswith('HEAD')
    assert scrubbed.endswith('TAIL')
    assert 'trimmed' in scrubbed


def _app():
    app = Flask(__name__)
    app.config.update(JOB_LOG_ERROR_MAX_CHARS=4000)
    return app


def _stub_recording(monkeypatch, calls):
    monkeypatch.setattr(JobLogService, '_record_start',
                        lambda job_name, started_at: calls.append(('start', job_name)) or 7)
    monkeypatch.setattr(
        JobLogService, '_record_finish',
        lambda log_id, finished_at, duration, success, error_type, detail:
            calls.append(('finish', log_id, success, error_type, detail)))


def test_successful_run_is_recorded(monkeypatch):
    """A job that completes is recorded as a success."""
    calls = []
    _stub_recording(monkeypatch, calls)

    with _app().app_context():
        with JobLogService.track('COMMENT_REDACT'):
            pass

    assert calls[0] == ('start', 'COMMENT_REDACT')
    assert calls[1][2] is True, 'the run has to be marked successful'


def test_failed_run_is_recorded_with_redacted_detail_and_reraises(monkeypatch):
    """A job that raises is recorded with a scrubbed traceback, and the error still escapes."""
    calls = []
    _stub_recording(monkeypatch, calls)

    with _app().app_context():
        with pytest.raises(ValueError):
            with JobLogService.track('PURGE'):
                raise ValueError(PARTICIPANT_ERROR)

    _, log_id, success, error_type, detail = calls[1]
    assert (log_id, success, error_type) == (7, False, 'ValueError')
    assert 'participant@example.com' not in detail
    assert '4471' not in detail


def test_logging_failure_does_not_break_the_job(monkeypatch):
    """A database outage must not stop the job from completing."""
    def explode(*_args):
        raise RuntimeError('analytics database is down')

    monkeypatch.setattr(JobLogService, '_record_start', explode)
    monkeypatch.setattr(JobLogService, '_record_finish', explode)
    ran = []

    with _app().app_context():
        with JobLogService.track('ENGAGEMENT_PUBLISH'):
            ran.append(True)

    assert ran == [True]

"""Checks that one failing subscriber or engagement does not stop the other emails."""
from datetime import datetime
from http.client import RemoteDisconnected
from types import SimpleNamespace

from flask import Flask
import pytest
import requests
from itsdangerous import URLSafeSerializer
from sqlalchemy.exc import OperationalError
from urllib3 import exceptions as urllib3_errors

from met_api.constants.notification_status import NotificationStatus
from met_api.exceptions.business_exception import BusinessException
from met_cron.services import closing_soon_mail_service, mail_service, publish_mail_service
from met_cron.services.closing_soon_mail_service import ClosingSoonEmailService
from met_cron.services.mail_service import EmailService, SendResult
from met_cron.services.publish_mail_service import PublishEmailService


SECRET = 'cron-test-secret'
GOOD = URLSafeSerializer(SECRET)
WRONG_KEY = URLSafeSerializer('another-key')
SEND_URL = 'https://notify.example.com/api/messages'
TOKEN_URL = 'https://login.example.com/auth/realms/standard/protocol/openid-connect/token'
ONE_SENT = SendResult(sent=1, failed=0, ambiguous=0, skipped=0, duplicate=0)
TEMPLATE = SimpleNamespace(render=lambda **_: 'body')


def _app(**config):
    app = Flask(__name__)
    app.config.update(EMAIL_SECRET_KEY=SECRET, MAIL_BATCH_SIZE='10', OFFSET_DAYS='2',
                      UNSUBSCRIBE_PATH='/unsubscribe/{token}', ENGAGEMENT_VIEW_PATH='/engagements/{engagement_id}')
    app.config.update(config)
    return app


def _request(url):
    return requests.Request('POST', url).prepare()


def _http_error(status_code, url=SEND_URL):
    response = requests.Response()
    response.status_code = status_code
    response.request = _request(url)
    return requests.HTTPError(f'{status_code} error', response=response)


def _max_retry(reason):
    return urllib3_errors.MaxRetryError(None, '/api/messages', reason=reason)


NOT_DELIVERED = {
    'connect timeout': lambda: requests.ConnectTimeout('timed out', request=_request(SEND_URL)),
    'connection refused': lambda: requests.ConnectionError(
        _max_retry(urllib3_errors.NewConnectionError(None, 'refused')), request=_request(SEND_URL)),
    'client error from the mail service': lambda: _http_error(400),
    'read timeout on the token request': lambda: requests.ReadTimeout('timed out', request=_request(TOKEN_URL)),
    'unreadable token response': lambda: requests.exceptions.InvalidJSONError('Expecting value'),
}

MAYBE_DELIVERED = {
    'read timeout': lambda: requests.ReadTimeout('timed out', request=_request(SEND_URL)),
    'server error from the mail service': lambda: _http_error(503),
    'connection aborted': lambda: requests.ConnectionError(
        urllib3_errors.ProtocolError('Connection aborted.', RemoteDisconnected('closed')), request=_request(SEND_URL)),
    'tls failure': lambda: requests.exceptions.SSLError(
        _max_retry(urllib3_errors.SSLError('bad record mac')), request=_request(SEND_URL)),
}


class _QueuedMail:  # pylint: disable=too-few-public-methods
    def __init__(self, entity_id, created_date=datetime(2026, 3, 1), updated_date=None, fail_commits=()):
        self.id = entity_id
        self.entity_id = entity_id
        self.created_date = created_date
        self.updated_date = updated_date
        self.notification_status = None
        self.commits = []
        self._fail_commits = fail_commits

    @property
    def saved(self):
        """Statuses whose commit went through, in order."""
        return [status for status, committed in self.commits if committed]

    def commit(self):
        """Record the commit; the attempts numbered in fail_commits raise like a lost connection."""
        committed = len(self.commits) + 1 not in self._fail_commits
        self.commits.append((self.notification_status, committed))
        if not committed:
            raise OperationalError('UPDATE email_queue', {}, Exception('connection lost'))


class _Session:  # pylint: disable=too-few-public-methods
    """A session whose rollback raises rollback_error if one is set."""

    def __init__(self, rollback_error=None):
        self.rollback_error = rollback_error

    def rollback(self):
        """Raise rollback_error if one is set."""
        if self.rollback_error:
            raise self.rollback_error


def _lost_connection():
    return OperationalError('ROLLBACK', {}, Exception('connection lost'))


def _stub_db(monkeypatch, session):
    for module in (mail_service, closing_soon_mail_service):
        monkeypatch.setattr(module, 'db', SimpleNamespace(session=session))


def _stub_subscribers_and_template(monkeypatch, participants, **stubs):
    """Serve participants {participant_id: encoded address} as one engagement's subscribers and record the calls.

    stubs can replace send_email, fetch_token or unsubscribe, and set the engagement's metadata.
    """
    calls = SimpleNamespace(queries=[], metadata_lookups=0, engagement_args=0, token_fetches=0,
                            sent_to=[], tokens=[], unsubscribe=[])
    rows = [(subscription_id, participant_id, address)
            for subscription_id, (participant_id, address) in enumerate(participants.items(), start=1)]

    def find_metadata(_engagement_id):
        calls.metadata_lookups += 1
        return stubs.get('metadata')

    def site_url(_tenant_id):
        calls.engagement_args += 1
        return 'https://engage.example.com'

    def create_unsubscribe_token(participant_id, _engagement_id):
        calls.unsubscribe.append(participant_id)
        return stubs.get('unsubscribe', str)(participant_id)

    def get_send_email_token():
        calls.token_fetches += 1
        return f'token-{calls.token_fetches}'

    def send(**kwargs):
        calls.sent_to.append(kwargs['email'])
        calls.tokens.append(kwargs['token'])

    _stub_db(monkeypatch, _Session())
    monkeypatch.setattr(mail_service.EngagementModel, 'find_by_id', lambda _id: SimpleNamespace(
        id=_id, tenant_id=1, name='Engagement', end_date=datetime(2026, 3, 1)))
    monkeypatch.setattr(mail_service.TenantModel, 'find_by_id', lambda _id: SimpleNamespace(name='Tenant'))
    monkeypatch.setattr(mail_service.EngagementMetadataModel, 'find_by_id', find_metadata)
    monkeypatch.setattr(mail_service.SubscriptionModel, 'get_confirmed_for_engagement',
                        lambda *args: calls.queries.append(args) or rows)
    monkeypatch.setattr(mail_service.notification, 'get_tenant_site_url', site_url)
    monkeypatch.setattr(mail_service.EmailVerificationService, 'create_unsubscribe_token', create_unsubscribe_token)
    monkeypatch.setattr(publish_mail_service.Template, 'get_template',
                        lambda _name: TEMPLATE)
    monkeypatch.setattr(mail_service.notification, 'get_send_email_token',
                        stubs.get('fetch_token', get_send_email_token))
    monkeypatch.setattr(mail_service.notification, 'send_email', stubs.get('send_email', send))
    return calls


def _scripted(outcomes, on_success):
    """Raise the next exception in outcomes, or call on_success when the next outcome is None or none are left."""
    remaining = list(outcomes)

    def call(**kwargs):
        outcome = remaining.pop(0) if remaining else None
        if outcome is not None:
            raise outcome
        return on_success(**kwargs)
    return call


def _failing_send(error):
    def send_email(**_kwargs):
        raise error
    return send_email


def _queue(monkeypatch, *mails):
    monkeypatch.setattr(publish_mail_service.EmailQueueModel, 'get_unprocessed_mails_for_open_engagements',
                        lambda size: list(mails)[:size] if size else list(mails))


def _stub_engagement_sends(monkeypatch, failing_ids, session=None):
    """Record which engagements are sent; the ones in failing_ids raise."""
    attempted = []

    def send(engagement_id, *_):
        attempted.append(engagement_id)
        if engagement_id in failing_ids:
            raise OperationalError('SELECT engagement', {}, Exception('engagement lookup failed'))
        return ONE_SENT

    _stub_db(monkeypatch, session or _Session())
    monkeypatch.setattr(publish_mail_service.Template, 'get_template', lambda _name: None)
    monkeypatch.setattr(closing_soon_mail_service.Template, 'get_template', lambda _name: None)
    monkeypatch.setattr(EmailService, '_send_email_notification_for_subscription', send)
    return attempted


def test_undecodable_subscriber_does_not_block_the_others(monkeypatch, caplog):
    """A subscriber whose address cannot be decoded is skipped and logged by type only."""
    undecodable = WRONG_KEY.dumps('broken@example.com')
    calls = _stub_subscribers_and_template(monkeypatch, {
        1: GOOD.dumps('first@example.com'),
        2: undecodable,
        3: GOOD.dumps('third@example.com'),
        4: GOOD.dumps('first@example.com'),
    })
    mail = _QueuedMail(entity_id=42)
    _queue(monkeypatch, mail)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert calls.sent_to == ['first@example.com', 'third@example.com']
    assert mail.notification_status == NotificationStatus.SENT.value
    assert 'BadSignature' in caplog.text
    assert not [part for part in undecodable.split('.') if part in caplog.text]


def test_lost_database_after_a_confirmed_send_marks_the_row_sent(monkeypatch):
    """Once one email was confirmed, a lost database connection must not queue the row for a resend."""
    def unsubscribe(participant_id):
        if participant_id != 1:
            raise OperationalError('INSERT email_verification', {}, Exception('connection lost'))
        return 'unsubscribe'

    calls = _stub_subscribers_and_template(
        monkeypatch, {1: GOOD.dumps('first@example.com'), 2: GOOD.dumps('second@example.com')},
        unsubscribe=unsubscribe)
    mail_service.db.session.rollback_error = _lost_connection()
    mail = _QueuedMail(entity_id=42)
    _queue(monkeypatch, mail)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert calls.sent_to == ['first@example.com']
    assert mail.notification_status == NotificationStatus.SENT.value


@pytest.mark.parametrize('make_error', MAYBE_DELIVERED.values(), ids=MAYBE_DELIVERED.keys())
def test_maybe_delivered_send_leaves_the_row_processing(monkeypatch, make_error):
    """A send the mail service may have accepted is never queued again, so nobody is mailed twice."""
    _stub_subscribers_and_template(monkeypatch, {1: GOOD.dumps('first@example.com')},
                                   send_email=_failing_send(make_error()))
    mail = _QueuedMail(entity_id=42)
    _queue(monkeypatch, mail)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert mail.notification_status == NotificationStatus.PROCESSING.value


@pytest.mark.parametrize('make_error', NOT_DELIVERED.values(), ids=NOT_DELIVERED.keys())
def test_send_not_delivered_requeues_the_row(monkeypatch, make_error):
    """A send that provably never reached the mail service queues the row again for the next run."""
    _stub_subscribers_and_template(monkeypatch, {1: GOOD.dumps('first@example.com')},
                                   send_email=_failing_send(make_error()))
    mail = _QueuedMail(entity_id=42)
    _queue(monkeypatch, mail)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert mail.notification_status is None


def test_row_is_queued_again_when_every_subscriber_fails_before_sending(monkeypatch):
    """No send tried and some subscribers failed: the job fails and the row is retried."""
    _stub_subscribers_and_template(monkeypatch, {1: WRONG_KEY.dumps('broken@example.com')})
    mail = _QueuedMail(entity_id=42)
    _queue(monkeypatch, mail)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert mail.notification_status is None


def test_skipped_address_does_not_count_as_sent(monkeypatch):
    """An invalid address is skipped, not sent, so a failure beside it still queues the row again."""
    calls = _stub_subscribers_and_template(monkeypatch, {
        1: GOOD.dumps('not-an-address'),
        2: WRONG_KEY.dumps('broken@example.com'),
    })
    mail = _QueuedMail(entity_id=42)
    _queue(monkeypatch, mail)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert not calls.sent_to
    assert mail.notification_status is None


@pytest.mark.parametrize('participants', [
    {},
    {None: GOOD.dumps('first@example.com'), 2: None, 3: GOOD.dumps('not-an-address')},
], ids=['no matching subscriber', 'every subscriber skipped'])
def test_row_with_nothing_to_send_is_marked_sent(monkeypatch, participants):
    """An engagement with nobody to email finishes without a token request or engagement args: the row ends SENT."""
    def no_token():
        raise AssertionError('a token was requested with nobody to email')

    calls = _stub_subscribers_and_template(monkeypatch, participants, fetch_token=no_token)
    mail = _QueuedMail(entity_id=42)
    _queue(monkeypatch, mail)

    with _app().app_context():
        PublishEmailService.do_mail()

    assert calls.engagement_args == 0
    assert mail.notification_status == NotificationStatus.SENT.value


def test_missing_participant_is_skipped(monkeypatch):
    """A subscription without a participant is skipped, not a failure."""
    _stub_subscribers_and_template(monkeypatch, {1: GOOD.dumps('first@example.com'), None: None})

    with _app().app_context():
        result = EmailService.send_engagement_emails(42, None, 'subject', TEMPLATE, 'Publish')

    assert result.sent == 1
    assert result.skipped == 1
    assert result.failed == 0


@pytest.mark.parametrize('make_error, sends, sent, failed', [
    (NOT_DELIVERED['connect timeout'], 2, 1, 0),
    (MAYBE_DELIVERED['read timeout'], 1, 0, 1),
], ids=['not delivered', 'maybe delivered'])
def test_same_address_resent_only_if_not_delivered(monkeypatch, make_error, sends, sent, failed):
    """A second subscription with the same address gets the email only if the first send never arrived."""
    calls = []

    def send_email(**kwargs):
        calls.append(kwargs['email'])
        if len(calls) == 1:
            raise make_error()

    _stub_subscribers_and_template(monkeypatch, {
        1: GOOD.dumps('same@example.com'),
        2: GOOD.dumps('same@example.com'),
    }, send_email=send_email)

    with _app().app_context():
        result = EmailService.send_engagement_emails(42, None, 'subject', TEMPLATE, 'Publish')

    assert len(calls) == sends
    assert result.sent == sent
    assert result.failed == failed
    assert result.duplicate == 1


def test_failed_engagement_and_rollback_do_not_stop_the_next_row(monkeypatch):
    """A row whose engagement send fails goes back to unprocessed, even if the rollback fails too."""
    _stub_engagement_sends(monkeypatch, failing_ids={1}, session=_Session(rollback_error=_lost_connection()))
    failing, working = _QueuedMail(entity_id=1), _QueuedMail(entity_id=2)
    _queue(monkeypatch, failing, working)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert failing.notification_status is None
    assert working.notification_status == NotificationStatus.SENT.value


def test_failed_processing_commit_skips_the_row(monkeypatch):
    """A row that cannot be marked PROCESSING is not sent, since the next run would send it again."""
    attempted = _stub_engagement_sends(monkeypatch, failing_ids=set())
    stuck, working = _QueuedMail(entity_id=1, fail_commits=(1, 2)), _QueuedMail(entity_id=2)
    _queue(monkeypatch, stuck, working)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert attempted == [2]
    assert working.notification_status == NotificationStatus.SENT.value


def test_failed_status_commit_is_retried_and_the_loop_continues(monkeypatch):
    """A final status commit that fails once is retried, and the next row is still processed."""
    _stub_engagement_sends(monkeypatch, failing_ids=set())
    retried, working = _QueuedMail(entity_id=1, fail_commits=(2,)), _QueuedMail(entity_id=2)
    _queue(monkeypatch, retried, working)

    with _app().app_context():
        PublishEmailService.do_mail()

    assert retried.saved == [NotificationStatus.PROCESSING.value, NotificationStatus.SENT.value]
    assert working.notification_status == NotificationStatus.SENT.value


def test_status_commit_failing_twice_fails_the_job(monkeypatch):
    """A final status that cannot be saved fails the job, and the next row is still processed."""
    _stub_engagement_sends(monkeypatch, failing_ids=set())
    unsaved, working = _QueuedMail(entity_id=1, fail_commits=(2, 3)), _QueuedMail(entity_id=2)
    _queue(monkeypatch, unsaved, working)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert working.notification_status == NotificationStatus.SENT.value


def test_oldest_queued_row_goes_first(monkeypatch):
    """Rows go oldest first by last update, so a row that keeps failing cannot block newer ones."""
    attempted = _stub_engagement_sends(monkeypatch, failing_ids=set())
    requeued = _QueuedMail(entity_id=1, created_date=datetime(2026, 2, 28), updated_date=datetime(2026, 3, 3))
    newer = _QueuedMail(entity_id=2, created_date=datetime(2026, 3, 2))
    older = _QueuedMail(entity_id=3, created_date=datetime(2026, 3, 1))
    _queue(monkeypatch, requeued, newer, older)

    with _app(MAIL_BATCH_SIZE='2').app_context():
        PublishEmailService.do_mail()

    assert attempted == [3, 2]


def test_closing_soon_continues_past_a_failing_engagement_and_rollback(monkeypatch):
    """An engagement whose send and rollback fail does not stop the engagements after it."""
    attempted = _stub_engagement_sends(monkeypatch, failing_ids={1},
                                       session=_Session(rollback_error=_lost_connection()))
    monkeypatch.setattr(ClosingSoonEmailService, 'get_public_engagements_closing_soon',
                        lambda _days: [SimpleNamespace(id=1), SimpleNamespace(id=2)])

    with _app().app_context():
        with pytest.raises(BusinessException):
            ClosingSoonEmailService.do_mail()

    assert attempted == [1, 2]


@pytest.mark.parametrize('metadata, query', [
    (SimpleNamespace(project_id='p1', project_metadata={}), (42, True, 'p1')),
    (None, (42, False, None)),
], ids=['with metadata', 'without metadata'])
def test_engagement_lookups_and_token_run_once_for_many_subscribers(monkeypatch, metadata, query):
    """One query, one metadata lookup, one set of engagement args and one token serve every subscriber."""
    calls = _stub_subscribers_and_template(monkeypatch, {
        1: GOOD.dumps('first@example.com'),
        2: GOOD.dumps('second@example.com'),
        3: GOOD.dumps('third@example.com'),
    }, metadata=metadata)

    with _app().app_context():
        result = EmailService.send_engagement_emails(42, None, 'subject', TEMPLATE, 'Publish')

    assert result.sent == 3
    assert calls.queries == [query]
    assert calls.metadata_lookups == 1
    assert calls.engagement_args == 1
    assert calls.token_fetches == 1
    assert calls.tokens == ['token-1', 'token-1', 'token-1']
    assert calls.unsubscribe == [1, 2, 3]


def test_expired_token_is_fetched_again_once(monkeypatch):
    """A 401 on a token that already worked fetches a new token and retries that send."""
    calls = _stub_subscribers_and_template(
        monkeypatch, {1: GOOD.dumps('first@example.com'), 2: GOOD.dumps('second@example.com')})
    record = mail_service.notification.send_email
    monkeypatch.setattr(mail_service.notification, 'send_email', _scripted([None, _http_error(401)], record))
    mail = _QueuedMail(entity_id=42)
    _queue(monkeypatch, mail)

    with _app().app_context():
        PublishEmailService.do_mail()

    assert calls.token_fetches == 2
    assert calls.tokens == ['token-1', 'token-2']
    assert mail.notification_status == NotificationStatus.SENT.value


def test_refused_new_token_is_not_retried(monkeypatch):
    """A 401 on a token that never worked is not retried; the send was not delivered, so the row is queued again."""
    calls = _stub_subscribers_and_template(monkeypatch, {1: GOOD.dumps('first@example.com')},
                                           send_email=_failing_send(_http_error(401)))
    mail = _QueuedMail(entity_id=42)
    _queue(monkeypatch, mail)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert calls.token_fetches == 1
    assert mail.notification_status is None


@pytest.mark.parametrize('fetch_outcomes, send_errors, subscribers, expected', [
    (['fail'], [], 3, (2, 2, NotificationStatus.SENT.value)),
    (['fail', 'fail'], [], 4, (2, 0, None)),
    (['ok', 'fail', 'fail'], [None, _http_error(401)], 4, (3, 1, NotificationStatus.SENT.value)),
    (['fail', 'ok', 'fail'], [None, _http_error(401)], 4, (4, 2, NotificationStatus.SENT.value)),
], ids=['one failed request', 'two failed requests in a row', 'failed requests after an expired token',
        'failed requests not in a row'])
def test_token_failure_retries_then_stops(monkeypatch, fetch_outcomes, send_errors, subscribers, expected):
    """A failed token request fails only that subscriber; two in a row stop the engagement.

    expected is (token requests, emails sent, final row status).
    """
    fetches = []

    def fetch_token():
        fetches.append(fetch_outcomes[len(fetches)] if len(fetches) < len(fetch_outcomes) else 'ok')
        if fetches[-1] == 'fail':
            raise NOT_DELIVERED['read timeout on the token request']()
        return f'token-{len(fetches)}'

    calls = _stub_subscribers_and_template(
        monkeypatch, {index: GOOD.dumps(f'person{index}@example.com') for index in range(1, subscribers + 1)},
        fetch_token=fetch_token)
    monkeypatch.setattr(mail_service.notification, 'send_email',
                        _scripted(send_errors, mail_service.notification.send_email))
    mail = _QueuedMail(entity_id=42)
    _queue(monkeypatch, mail)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert (len(fetches), len(calls.sent_to), mail.notification_status) == expected

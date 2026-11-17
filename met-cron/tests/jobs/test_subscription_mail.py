"""Checks that one failing subscriber or engagement does not stop the other emails."""
from types import SimpleNamespace

from flask import Flask
import pytest
import requests
from itsdangerous import URLSafeSerializer
from sqlalchemy.exc import OperationalError

from met_api.constants.notification_status import NotificationStatus
from met_api.exceptions.business_exception import BusinessException
from met_api.models.participant import Participant as ParticipantModel
from met_cron.services import closing_soon_mail_service, mail_service, publish_mail_service
from met_cron.services.closing_soon_mail_service import ClosingSoonEmailService
from met_cron.services.mail_service import EmailService, SendResult
from met_cron.services.publish_mail_service import PublishEmailService


SECRET = 'cron-test-secret'
GOOD = URLSafeSerializer(SECRET)
WRONG_KEY = URLSafeSerializer('another-key')


def _app():
    app = Flask(__name__)
    app.config.update(EMAIL_SECRET_KEY=SECRET, MAIL_BATCH_SIZE='10', OFFSET_DAYS='2')
    return app


class _QueuedMail:
    def __init__(self, entity_id):
        self.entity_id = entity_id
        self.notification_status = None
        self.updated_date = None

    def commit(self):
        pass


class _Session:
    """Answers any query chain with the given rows; a rollback expires them like ORM rows."""

    def __init__(self, rows=None):
        self.rows = rows or []
        self.rolled_back = False

    def query(self, *_):
        return self

    def all(self):
        return self.rows

    def rollback(self):
        self.rolled_back = True

    def __getattr__(self, _name):
        return lambda *_args, **_kwargs: self


class _Subscription:
    def __init__(self, session, participant_id):
        self._session = session
        self._participant_id = participant_id

    def __getattr__(self, name):
        if name in ('id', 'participant_id') and not self._session.rolled_back:
            return self._participant_id
        raise OperationalError('SELECT subscription', {}, Exception('expired row needs the database'))


def _stub_db(monkeypatch, session):
    for module in (mail_service, publish_mail_service, closing_soon_mail_service):
        monkeypatch.setattr(module, 'db', SimpleNamespace(session=session))


def _stub_subscribers_and_template(monkeypatch, participants, find_participant=None, send_email=None):
    """Serve the participants as confirmed subscribers, skip template rendering, record who gets mail."""
    session = _Session()
    session.rows = [_Subscription(session, participant_id) for participant_id in participants]
    _stub_db(monkeypatch, session)
    monkeypatch.setattr(mail_service.EngagementModel, 'find_by_id', lambda _id: SimpleNamespace(id=_id))
    monkeypatch.setattr(mail_service.CheckSubscription, 'check_subscription', lambda *_: True)
    monkeypatch.setattr(ParticipantModel, 'find_by_id', find_participant or (
        lambda _id: SimpleNamespace(id=_id, email_address=participants[_id])))
    monkeypatch.setattr(EmailService, '_render_email_template', lambda *_: ('body', {}))
    monkeypatch.setattr(publish_mail_service.Template, 'get_template', lambda _name: None)
    sent_to = []
    monkeypatch.setattr(mail_service.notification, 'send_email',
                        send_email or (lambda **kwargs: sent_to.append(kwargs['email'])))
    return sent_to


def _queue(monkeypatch, *mails):
    monkeypatch.setattr(publish_mail_service.EmailQueueModel, 'get_unprocessed_mails_for_open_engagements',
                        lambda _size: list(mails))


def test_undecodable_subscriber_does_not_block_the_others(monkeypatch, caplog):
    """A subscriber whose address cannot be decoded is skipped and logged by type only."""
    undecodable = WRONG_KEY.dumps('broken@example.com')
    sent_to = _stub_subscribers_and_template(monkeypatch, {
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

    assert sent_to == ['first@example.com', 'third@example.com']
    assert mail.notification_status == NotificationStatus.SENT.value
    assert 'BadSignature' in caplog.text
    assert not [part for part in undecodable.split('.') if part in caplog.text]


def test_lost_database_after_a_confirmed_send_marks_the_row_sent(monkeypatch):
    """Once one email was confirmed, a lost database connection must not queue the row for a resend."""
    participants = {1: GOOD.dumps('first@example.com'), 2: GOOD.dumps('second@example.com')}

    def find_participant(participant_id):
        if participant_id != 1:
            raise OperationalError('SELECT participant', {}, Exception('connection lost'))
        return SimpleNamespace(id=participant_id, email_address=participants[participant_id])

    sent_to = _stub_subscribers_and_template(monkeypatch, participants, find_participant)
    session = mail_service.db.session

    def lost_rollback():
        session.rolled_back = True
        raise OperationalError('ROLLBACK', {}, Exception('connection lost'))

    monkeypatch.setattr(session, 'rollback', lost_rollback)
    mail = _QueuedMail(entity_id=42)
    _queue(monkeypatch, mail)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert sent_to == ['first@example.com']
    assert mail.notification_status == NotificationStatus.SENT.value


def test_unconfirmed_send_leaves_the_row_processing(monkeypatch):
    """A send that may have reached the mail service is never queued again, so nobody is mailed twice."""
    def time_out(**_kwargs):
        raise requests.ReadTimeout('read timed out')

    _stub_subscribers_and_template(monkeypatch, {1: GOOD.dumps('first@example.com')}, send_email=time_out)
    mail = _QueuedMail(entity_id=42)
    _queue(monkeypatch, mail)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert mail.notification_status == NotificationStatus.PROCESSING.value


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
    sent_to = _stub_subscribers_and_template(monkeypatch, {
        1: GOOD.dumps('not-an-address'),
        2: WRONG_KEY.dumps('broken@example.com'),
    })
    mail = _QueuedMail(entity_id=42)
    _queue(monkeypatch, mail)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert sent_to == []
    assert mail.notification_status is None


def test_failed_engagement_send_is_queued_again_and_the_next_row_is_sent(monkeypatch):
    """A row whose engagement send fails goes back to unprocessed, and the rows after it are still sent."""
    def send(engagement_id, *_):
        if engagement_id == 1:
            raise RuntimeError('engagement lookup failed')
        return SendResult(sent=1, attempted=1, failed=0, skipped=0)

    failing, working = _QueuedMail(entity_id=1), _QueuedMail(entity_id=2)
    _queue(monkeypatch, failing, working)
    _stub_db(monkeypatch, _Session())
    monkeypatch.setattr(publish_mail_service.Template, 'get_template', lambda _name: None)
    monkeypatch.setattr(EmailService, '_send_email_notification_for_subscription', send)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert failing.notification_status is None
    assert working.notification_status == NotificationStatus.SENT.value


def test_closing_soon_continues_past_a_failing_engagement(monkeypatch):
    """An engagement whose send fails does not stop the engagements after it."""
    attempted = []

    def send(engagement_id, *_):
        attempted.append(engagement_id)
        if engagement_id == 1:
            raise RuntimeError('engagement lookup failed')
        return SendResult(sent=1, attempted=1, failed=0, skipped=0)

    _stub_db(monkeypatch, _Session())
    monkeypatch.setattr(ClosingSoonEmailService, 'get_public_engagements_closing_soon',
                        lambda _days: [SimpleNamespace(id=1), SimpleNamespace(id=2)])
    monkeypatch.setattr(closing_soon_mail_service.Template, 'get_template', lambda _name: None)
    monkeypatch.setattr(EmailService, '_send_email_notification_for_subscription', send)

    with _app().app_context():
        with pytest.raises(BusinessException):
            ClosingSoonEmailService.do_mail()

    assert attempted == [1, 2]

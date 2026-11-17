"""Checks that one failing subscriber or engagement does not stop the other emails."""
from types import SimpleNamespace

from flask import Flask
import pytest
from itsdangerous import URLSafeSerializer

from met_api.constants.notification_status import NotificationStatus
from met_api.exceptions.business_exception import BusinessException
from met_api.models.participant import Participant as ParticipantModel
from met_cron.services import closing_soon_mail_service, mail_service, publish_mail_service
from met_cron.services.closing_soon_mail_service import ClosingSoonEmailService
from met_cron.services.mail_service import EmailService
from met_cron.services.publish_mail_service import PublishEmailService


SECRET = 'cron-test-secret'


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


def _stub_subscribers(monkeypatch, participants):
    """Serve the given participants as confirmed subscribers and record who gets mail."""
    subscriptions = [SimpleNamespace(id=index, participant_id=index) for index in participants]
    query = SimpleNamespace(distinct=lambda: SimpleNamespace(filter=lambda *_: SimpleNamespace(
        all=lambda: subscriptions)))
    session = SimpleNamespace(query=lambda *_: query, rollback=lambda: None)
    monkeypatch.setattr(mail_service, 'db', SimpleNamespace(session=session))
    monkeypatch.setattr(mail_service.EngagementModel, 'find_by_id', lambda _id: SimpleNamespace(id=_id))
    monkeypatch.setattr(mail_service.CheckSubscription, 'check_subscription', lambda *_: True)
    monkeypatch.setattr(ParticipantModel, 'find_by_id',
                        lambda _id: SimpleNamespace(id=_id, email_address=participants[_id]))
    monkeypatch.setattr(EmailService, '_render_email_template', lambda *_: ('body', {}))
    monkeypatch.setattr(publish_mail_service.Template, 'get_template', lambda _name: None)
    sent_to = []
    monkeypatch.setattr(mail_service.notification, 'send_email', lambda **kwargs: sent_to.append(kwargs['email']))
    return sent_to


def test_undecodable_subscriber_does_not_block_the_others(monkeypatch):
    """A subscriber whose address cannot be decoded is skipped; each other address gets one email."""
    good = URLSafeSerializer(SECRET)
    participants = {
        1: good.dumps('first@example.com'),
        2: URLSafeSerializer('another-key').dumps('broken@example.com'),
        3: good.dumps('third@example.com'),
        4: good.dumps('first@example.com'),
    }
    sent_to = _stub_subscribers(monkeypatch, participants)
    mail = _QueuedMail(entity_id=42)
    monkeypatch.setattr(publish_mail_service.EmailQueueModel, 'get_unprocessed_mails_for_open_engagements',
                        lambda _size: [mail])

    with _app().app_context():
        PublishEmailService.do_mail()

    assert sent_to == ['first@example.com', 'third@example.com']
    assert mail.notification_status == NotificationStatus.SENT.value


def test_failed_engagement_send_is_queued_again(monkeypatch):
    """A queue row whose engagement send fails goes back to unprocessed, not stuck at PROCESSING."""
    def send(*_):
        raise RuntimeError('engagement lookup failed')

    mail = _QueuedMail(entity_id=42)
    monkeypatch.setattr(publish_mail_service.EmailQueueModel, 'get_unprocessed_mails_for_open_engagements',
                        lambda _size: [mail])
    monkeypatch.setattr(publish_mail_service.Template, 'get_template', lambda _name: None)
    monkeypatch.setattr(EmailService, '_send_email_notification_for_subscription', send)

    with _app().app_context():
        with pytest.raises(BusinessException):
            PublishEmailService.do_mail()

    assert mail.notification_status is None


def test_closing_soon_continues_past_a_failing_engagement(monkeypatch):
    """An engagement whose send fails does not stop the engagements after it."""
    attempted = []

    def send(engagement_id, *_):
        attempted.append(engagement_id)
        if engagement_id == 1:
            raise RuntimeError('engagement lookup failed')

    monkeypatch.setattr(ClosingSoonEmailService, 'get_public_engagements_closing_soon',
                        lambda _days: [SimpleNamespace(id=1), SimpleNamespace(id=2)])
    monkeypatch.setattr(closing_soon_mail_service.Template, 'get_template', lambda _name: None)
    monkeypatch.setattr(EmailService, '_send_email_notification_for_subscription', send)

    with _app().app_context():
        with pytest.raises(BusinessException):
            ClosingSoonEmailService.do_mail()

    assert attempted == [1, 2]

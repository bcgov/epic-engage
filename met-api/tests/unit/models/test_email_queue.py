"""Tests for the EmailQueue model."""
from sqlalchemy import select

from met_api.constants.notification_status import NotificationStatus
from met_api.models.db import db
from met_api.models.email_queue import EmailQueue
from met_api.utils.enums import SourceAction, SourceType


def _queued_mail():
    mail = EmailQueue(entity_id=1, entity_type=SourceType.ENGAGEMENT.value, action=SourceAction.PUBLISHED.value)
    mail.save()
    return mail


def _stored_status(mail_id):
    return db.session.execute(select(EmailQueue.notification_status).where(EmailQueue.id == mail_id)).scalar_one()


def test_claim_succeeds_once(session):  # pylint:disable=unused-argument
    """Only the first claim on an unprocessed row wins, so two overlapping runs cannot both send it."""
    mail_id = _queued_mail().id

    assert EmailQueue.claim(mail_id) is True
    assert EmailQueue.claim(mail_id) is False
    assert _stored_status(mail_id) == NotificationStatus.PROCESSING


def test_requeue_after_claim_is_stored(session):  # pylint:disable=unused-argument
    """Setting a claimed row back to unprocessed reaches the database, so the next run retries it."""
    mail = _queued_mail()
    EmailQueue.claim(mail.id)

    mail.notification_status = None
    mail.commit()

    assert _stored_status(mail.id) is None

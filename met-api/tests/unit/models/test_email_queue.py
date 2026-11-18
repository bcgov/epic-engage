"""Tests for the EmailQueue model."""
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from met_api.constants.notification_status import NotificationStatus
from met_api.models.db import db
from met_api.models.email_queue import EmailQueue
from met_api.utils.datetime import local_datetime
from met_api.utils.enums import SourceAction, SourceType
from tests.utilities.factory_scenarios import TestEngagementInfo
from tests.utilities.factory_utils import factory_engagement_model

MAX_ATTEMPTS = 3
BACKOFF_MINUTES = 30


def _queued_mail(entity_id=1, **fields):
    mail = EmailQueue(entity_id=entity_id, entity_type=SourceType.ENGAGEMENT.value,
                      action=SourceAction.PUBLISHED.value, **fields)
    mail.save()
    return mail


def _engagement_starting_today():
    return factory_engagement_model({**TestEngagementInfo.engagement1,
                                     'start_date': local_datetime().replace(tzinfo=None)})


def _stored(column, mail_id):
    return db.session.execute(select(column).where(EmailQueue.id == mail_id)).scalar()


def _unprocessed_ids(max_size=0):
    return [mail.id for mail in EmailQueue.get_unprocessed_mails_for_open_engagements(
        max_size, MAX_ATTEMPTS, BACKOFF_MINUTES)]


def test_claim_succeeds_once(session):  # pylint:disable=unused-argument
    """Only the first claim wins, and it is committed, so two overlapping runs cannot both send the row."""
    mail_id = _queued_mail().id

    assert EmailQueue.claim(mail_id, MAX_ATTEMPTS, BACKOFF_MINUTES) == 1
    assert EmailQueue.claim(mail_id, MAX_ATTEMPTS, BACKOFF_MINUTES) == 0
    db.session.rollback()
    assert _stored(EmailQueue.notification_status, mail_id) == NotificationStatus.PROCESSING
    assert _stored(EmailQueue.attempts, mail_id) == 1


def test_requeue_after_claim_is_stored(session):  # pylint:disable=unused-argument
    """Setting a claimed row back to unprocessed reaches the database, so the next run retries it."""
    mail = _queued_mail()
    EmailQueue.claim(mail.id, MAX_ATTEMPTS, BACKOFF_MINUTES)
    assert _stored(EmailQueue.notification_status, mail.id) == NotificationStatus.PROCESSING

    mail.notification_status = None
    mail.commit()

    assert _stored(EmailQueue.notification_status, mail.id) is None


@pytest.mark.parametrize('attempts, minutes_since_update, claimed_as', [
    (0, 0, 1),
    (1, BACKOFF_MINUTES - 5, 0),
    (1, BACKOFF_MINUTES + 5, 2),
    (MAX_ATTEMPTS, BACKOFF_MINUTES + 5, 0),
], ids=['never tried', 'inside backoff', 'past backoff', 'attempt cap reached'])
def test_row_is_sent_only_under_the_cap_and_past_the_backoff(session, attempts, minutes_since_update,
                                                             claimed_as):  # pylint:disable=unused-argument
    """A failed row waits out the backoff before it is listed or claimed again, and stops at the attempt cap."""
    engagement = _engagement_starting_today()
    mail = _queued_mail(engagement.id, attempts=attempts,
                        updated_date=datetime.utcnow() - timedelta(minutes=minutes_since_update))

    assert (mail.id in _unprocessed_ids()) is bool(claimed_as)
    assert EmailQueue.claim(mail.id, MAX_ATTEMPTS, BACKOFF_MINUTES) == claimed_as


def test_least_recently_tried_rows_come_first_within_the_batch(session):  # pylint:disable=unused-argument
    """The batch limit applies after ordering by last update, so a retried row cannot crowd out older ones."""
    engagement = _engagement_starting_today()
    now = datetime.utcnow()
    retried = _queued_mail(engagement.id, attempts=1, created_date=now - timedelta(days=1),
                           updated_date=now - timedelta(minutes=BACKOFF_MINUTES + 1))
    newer = _queued_mail(engagement.id, created_date=now - timedelta(hours=2), updated_date=now - timedelta(hours=2))
    older = _queued_mail(engagement.id, created_date=now - timedelta(hours=3), updated_date=now - timedelta(hours=3))

    assert _unprocessed_ids(max_size=2) == [older.id, newer.id]
    assert _unprocessed_ids() == [older.id, newer.id, retried.id]

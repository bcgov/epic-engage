"""Tests for the EmailQueue model."""
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select, update

from met_api.constants.engagement_status import Status as EngagementStatus
from met_api.constants.notification_status import NotificationStatus
from met_api.models.db import db
from met_api.models.email_queue import EmailQueue
from met_api.utils.datetime import local_datetime
from met_api.utils.enums import SourceAction, SourceType
from tests.utilities.factory_scenarios import TestEngagementInfo
from tests.utilities.factory_utils import factory_engagement_model

MAX_ATTEMPTS = 3
BACKOFF_MINUTES = 30
STALE_MINUTES = 60


def _queued_mail(entity_id=1, **fields):
    mail = EmailQueue(entity_id=entity_id, entity_type=SourceType.ENGAGEMENT.value,
                      action=SourceAction.PUBLISHED.value, **fields)
    mail.save()
    return mail


def _engagement(started_days_ago=0, status=EngagementStatus.Published.value):
    start = local_datetime().replace(tzinfo=None) - timedelta(days=started_days_ago)
    return factory_engagement_model({**TestEngagementInfo.engagement1, 'start_date': start}, status=status)


def _mail_past_backoff(engagement_id, attempts=1):
    return _queued_mail(engagement_id, attempts=attempts,
                        updated_date=datetime.utcnow() - timedelta(minutes=BACKOFF_MINUTES + 5))


def _stored(column, mail_id):
    return db.session.execute(select(column).where(EmailQueue.id == mail_id)).scalar()


def _backdate(mail_id, **minutes_ago):
    """Set each named timestamp column of the row to that many minutes before one shared now."""
    now = datetime.utcnow()
    db.session.execute(update(EmailQueue).where(EmailQueue.id == mail_id)
                       .values({name: now - timedelta(minutes=minutes) for name, minutes in minutes_ago.items()}))
    db.session.commit()


def _claimed_and_started():
    mail_id = _queued_mail().id
    EmailQueue.mark_send_started(mail_id, EmailQueue.claim(mail_id, MAX_ATTEMPTS, BACKOFF_MINUTES))
    return mail_id


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
    engagement = _engagement()
    mail = _queued_mail(engagement.id, attempts=attempts,
                        updated_date=datetime.utcnow() - timedelta(minutes=minutes_since_update))

    assert (mail.id in _unprocessed_ids()) is bool(claimed_as)
    assert EmailQueue.claim(mail.id, MAX_ATTEMPTS, BACKOFF_MINUTES) == claimed_as


def test_least_recently_tried_rows_come_first_within_the_batch(session):  # pylint:disable=unused-argument
    """The batch limit applies after ordering by last update, so a retried row cannot crowd out older ones."""
    engagement = _engagement()
    now = datetime.utcnow()
    retried = _queued_mail(engagement.id, attempts=1, created_date=now - timedelta(days=1),
                           updated_date=now - timedelta(minutes=BACKOFF_MINUTES + 1))
    newer = _queued_mail(engagement.id, created_date=now - timedelta(hours=2), updated_date=now - timedelta(hours=2))
    older = _queued_mail(engagement.id, created_date=now - timedelta(hours=3), updated_date=now - timedelta(hours=3))

    assert _unprocessed_ids(max_size=2) == [older.id, newer.id]
    assert _unprocessed_ids() == [older.id, newer.id, retried.id]


def test_retry_continues_after_the_start_date_while_published(session):  # pylint:disable=unused-argument
    """A row that failed late on the start date is still retried the next day instead of being dropped silently."""
    mail = _mail_past_backoff(_engagement(started_days_ago=1).id)

    assert mail.id in _unprocessed_ids()


@pytest.mark.parametrize('attempts, status, started_days_ago', [
    (0, EngagementStatus.Published.value, 1),
    (1, EngagementStatus.Closed.value, 1),
    (1, EngagementStatus.Published.value, 2),
], ids=['never tried', 'engagement closed', 'started two days ago'])
def test_row_after_the_start_date_is_not_listed(session, attempts, status,
                                                started_days_ago):  # pylint:disable=unused-argument
    """Only retries crossing one midnight on a still published engagement go out, so no old row is mailed."""
    mail = _mail_past_backoff(_engagement(started_days_ago, status).id, attempts=attempts)

    assert mail.id not in _unprocessed_ids()


@pytest.mark.parametrize('minutes_since_claim, requeued', [
    (STALE_MINUTES - 5, False),
    (STALE_MINUTES + 5, True),
], ids=['claim still fresh', 'claim stale'])
def test_stale_unstarted_row_is_requeued(session, minutes_since_claim,
                                         requeued):  # pylint:disable=unused-argument
    """A claim that never started sending is queued again once stale, whatever an earlier attempt recorded."""
    mail_id = _queued_mail(attempts=1, send_started_at=datetime.utcnow() - timedelta(days=1),
                           updated_date=datetime.utcnow() - timedelta(minutes=BACKOFF_MINUTES + 5)).id
    EmailQueue.claim(mail_id, MAX_ATTEMPTS, BACKOFF_MINUTES)
    _backdate(mail_id, updated_date=minutes_since_claim)

    assert ((mail_id, 1, 2) in EmailQueue.requeue_stale_unstarted(STALE_MINUTES)) is requeued
    assert (_stored(EmailQueue.notification_status, mail_id) is None) is requeued


def test_stale_started_row_is_left_processing(session):  # pylint:disable=unused-argument
    """A row whose send started may have been delivered, so the sweep never queues it again."""
    mail_id = _claimed_and_started()
    _backdate(mail_id, updated_date=STALE_MINUTES + 5, send_started_at=STALE_MINUTES + 5)

    assert mail_id not in [row[0] for row in EmailQueue.requeue_stale_unstarted(STALE_MINUTES)]
    assert _stored(EmailQueue.notification_status, mail_id) == NotificationStatus.PROCESSING


@pytest.mark.parametrize('started_ago, updated_ago, reported', [
    (STALE_MINUTES + 5, STALE_MINUTES + 5, True),
    (STALE_MINUTES - 5, STALE_MINUTES - 5, False),
    (STALE_MINUTES + 5, STALE_MINUTES, False),
    (2 * 24 * 60, 2 * 24 * 60, False),
], ids=['stale with no final status', 'still sending', 'final status saved', 'started two days ago'])
def test_stale_started_row_without_final_status_is_reported(session, started_ago, updated_ago,
                                                            reported):  # pylint:disable=unused-argument
    """Only a recent send that never saved its final status is reported, so deliberate PROCESSING rows stay quiet."""
    mail_id = _claimed_and_started()
    _backdate(mail_id, updated_date=updated_ago, send_started_at=started_ago)

    assert (mail_id in EmailQueue.find_stale_started_ids(STALE_MINUTES)) is reported


def test_send_start_from_an_earlier_claim_is_refused(session):  # pylint:disable=unused-argument
    """A run whose row was swept and claimed again cannot start sending it, so two runs never send one row."""
    mail_id = _queued_mail().id
    first = EmailQueue.claim(mail_id, MAX_ATTEMPTS, BACKOFF_MINUTES)
    _backdate(mail_id, updated_date=STALE_MINUTES + 5)
    EmailQueue.requeue_stale_unstarted(STALE_MINUTES)
    _backdate(mail_id, updated_date=BACKOFF_MINUTES + 5)
    second = EmailQueue.claim(mail_id, MAX_ATTEMPTS, BACKOFF_MINUTES)

    assert not EmailQueue.mark_send_started(mail_id, first)
    assert EmailQueue.mark_send_started(mail_id, second)

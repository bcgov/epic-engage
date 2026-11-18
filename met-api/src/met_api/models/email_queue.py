"""Email queue model class.

Manages the Email queue
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Tuple

from sqlalchemy import and_, func, or_, select, update

from met_api.constants.engagement_status import Status as EngagementStatus
from met_api.constants.notification_status import NotificationStatus
from met_api.models.engagement import Engagement
from met_api.utils.datetime import local_datetime
from met_api.utils.enums import SourceAction, SourceType
from .base_model import BaseModel
from .db import db

# Started rows stay PROCESSING for good, so the stale log stops after this window instead of repeating every run.
STALE_STARTED_LOG_WINDOW = timedelta(days=1)


class EmailQueue(BaseModel):  # pylint: disable=too-few-public-methods
    """Definition of the email queue entity."""

    __tablename__ = 'email_queue'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    entity_id = db.Column(db.Integer, nullable=False)  # id of the entity which triggers notificatio
    entity_type = db.Column(db.String(100),
                            nullable=False)  # type of the entity which triggers email ,like engagement , user
    action = db.Column(db.String(100))  # created , deleted etc
    notification_status = db.Column(db.Enum(NotificationStatus), nullable=True)
    attempts = db.Column(db.Integer, nullable=False, default=0, server_default='0')
    send_started_at = db.Column(db.DateTime, nullable=True)

    @classmethod
    def _ready_to_send(cls, max_attempts: int, backoff_minutes: int):
        """Unprocessed, under the attempt cap, and past the backoff since a failed attempt."""
        # updated_date is written with utcnow, so the cutoff must be UTC too.
        retry_from = datetime.utcnow() - timedelta(minutes=backoff_minutes)
        return and_(cls.notification_status.is_(None),
                    cls.attempts < max_attempts,
                    or_(cls.attempts == 0, func.coalesce(cls.updated_date, cls.created_date) <= retry_from))

    @classmethod
    def get_unprocessed_mails_for_open_engagements(cls, max_size: int, max_attempts: int,
                                                   backoff_minutes: int) -> List[EmailQueue]:
        """Return rows ready to send for engagements starting today, or retries from yesterday, oldest first."""
        now = local_datetime().date()
        query = db.session.query(cls)\
            .join(Engagement, Engagement.id == cls.entity_id)\
            .filter(cls._ready_to_send(max_attempts, backoff_minutes),
                    cls.entity_type == SourceType.ENGAGEMENT.value,
                    cls.action == SourceAction.PUBLISHED.value,
                    # A retry that crosses midnight still goes out while the engagement is published.
                    or_(func.date(Engagement.start_date) == now,
                        and_(cls.attempts > 0, func.date(Engagement.start_date) == now - timedelta(days=1),
                             Engagement.status_id == EngagementStatus.Published.value)))\
            .order_by(func.coalesce(cls.updated_date, cls.created_date), cls.id)
        if max_size:
            query = query.limit(max_size)
        return query.all()

    @classmethod
    def claim(cls, mail_id: int, max_attempts: int, backoff_minutes: int) -> int:
        """Mark a row ready to send PROCESSING, count the attempt and commit.

        Return the row's attempt count, or 0 when another run claimed it first or it is not ready to send.
        """
        attempts = db.session.execute(
            update(cls)
            .where(cls.id == mail_id, cls._ready_to_send(max_attempts, backoff_minutes))
            .values(notification_status=NotificationStatus.PROCESSING, attempts=cls.attempts + 1,
                    send_started_at=None)
            .returning(cls.attempts)).scalar()
        db.session.commit()
        return attempts or 0

    @classmethod
    def mark_send_started(cls, mail_id: int, attempts: int) -> bool:
        """Commit that the claim numbered attempts is about to send; False when the row now belongs to another claim."""
        now = datetime.utcnow()
        marked = db.session.execute(
            update(cls)
            .where(cls.id == mail_id, cls.notification_status == NotificationStatus.PROCESSING,
                   cls.attempts == attempts)
            .values(send_started_at=now, updated_date=now)
            .returning(cls.id)).scalar()
        db.session.commit()
        return marked is not None

    @classmethod
    def requeue_stale_unstarted(cls, stale_minutes: int) -> List[Tuple[int, int, int]]:
        """Requeue rows claimed over stale_minutes ago whose send never started; return (id, entity_id, attempts)."""
        # The claim stamps updated_date, so it dates the claim.
        cutoff = datetime.utcnow() - timedelta(minutes=stale_minutes)
        rows = db.session.execute(
            update(cls)
            .where(cls.notification_status == NotificationStatus.PROCESSING, cls.send_started_at.is_(None),
                   func.coalesce(cls.updated_date, cls.created_date) <= cutoff)
            .values(notification_status=None)
            .returning(cls.id, cls.entity_id, cls.attempts)).all()
        db.session.commit()
        return [tuple(row) for row in rows]

    @classmethod
    def find_stale_started_ids(cls, stale_minutes: int) -> List[int]:
        """Return rows whose send started over stale_minutes ago, within the last day, and has no final status."""
        now = datetime.utcnow()
        return db.session.execute(
            select(cls.id)
            .where(cls.notification_status == NotificationStatus.PROCESSING,
                   cls.send_started_at <= now - timedelta(minutes=stale_minutes),
                   cls.send_started_at > now - STALE_STARTED_LOG_WINDOW,
                   # A saved final status stamps updated_date after the send start.
                   cls.updated_date <= cls.send_started_at)
            .order_by(cls.id)).scalars().all()

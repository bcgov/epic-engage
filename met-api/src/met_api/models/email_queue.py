"""Email queue model class.

Manages the Email queue
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import List

from sqlalchemy import and_, func, or_, update

from met_api.constants.engagement_status import Status as EngagementStatus
from met_api.constants.notification_status import NotificationStatus
from met_api.models.engagement import Engagement
from met_api.utils.datetime import local_datetime
from met_api.utils.enums import SourceAction, SourceType
from .base_model import BaseModel
from .db import db


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
            .values(notification_status=NotificationStatus.PROCESSING, attempts=cls.attempts + 1)
            .returning(cls.attempts)).scalar()
        db.session.commit()
        return attempts or 0

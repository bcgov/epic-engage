"""Subscription model class.

Manages the Subscription
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, and_, exists, or_
from sqlalchemy.orm import aliased

from met_api.constants.subscription_type import SubscriptionType
from .base_model import BaseModel
from .db import db
from .engagement import Engagement
from .participant import Participant


class Subscription(BaseModel):  # pylint: disable=too-few-public-methods
    """Definition of the subscription entity."""

    __tablename__ = 'subscription'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    engagement_id = db.Column(db.Integer, nullable=True)
    participant_id = db.Column(db.Integer, ForeignKey('participant.id'), nullable=True)
    is_subscribed = db.Column(db.Boolean, nullable=False)
    project_id = db.Column(db.String(50))
    type = db.Column(db.Enum(SubscriptionType), nullable=True)

    @classmethod
    def get(cls) -> Subscription:
        """Get a subscription."""
        db_subscription = db.session.query(Subscription)
        return db_subscription

    @classmethod
    def get_confirmed_for_engagement(cls, engagement_id, has_metadata, project_id):
        """Return (subscription_id, participant_id, email_address) rows of confirmed subscriptions for the engagement.

        Matches: TENANT in the same tenant, ENGAGEMENT by engagement, PROJECT by project when metadata exists.
        """
        source = aliased(Engagement)
        target = aliased(Engagement)
        # NOT EXISTS so a subscription with no engagement, or a NULL tenant on either side, keeps matching.
        other_tenant = exists().where(source.id == cls.engagement_id, target.id == engagement_id,
                                      source.tenant_id != target.tenant_id)
        matches = [
            and_(cls.type == SubscriptionType.TENANT, ~other_tenant),
            and_(cls.type == SubscriptionType.ENGAGEMENT, cls.engagement_id == engagement_id),
        ]
        if has_metadata:
            # NULL matches NULL, as the earlier Python comparison of the two project ids did.
            matches.append(and_(cls.type == SubscriptionType.PROJECT, cls.project_id.is_not_distinct_from(project_id)))
        return db.session.query(cls.id.label('subscription_id'),
                                Participant.id.label('participant_id'),
                                Participant.email_address.label('email_address'))\
            .outerjoin(Participant, Participant.id == cls.participant_id)\
            .filter(cls.is_subscribed.is_(True), or_(*matches))\
            .order_by(cls.id)\
            .all()

    @classmethod
    def get_by_engagement_id(cls, engagement_id) -> Subscription:
        """Get a subscription."""
        db_subscription = db.session.query(Subscription)\
            .filter_by(engagement_id=engagement_id)\
            .order_by(Subscription.created_date.desc())\
            .first()
        return db_subscription

    @classmethod
    def get_by_participant_id(cls, participant_id) -> Subscription:
        """Get a subscription."""
        db_subscription = db.session.query(Subscription)\
            .filter_by(participant_id=participant_id)\
            .order_by(Subscription.created_date.desc())\
            .first()
        return db_subscription

    @classmethod
    def get_by_participant_and_eng_id(cls, participant_id, engagement_id) -> Subscription:
        """Get a subscription."""
        db_subscription = db.session.query(Subscription)\
            .filter_by(participant_id=participant_id, engagement_id=engagement_id)\
            .order_by(Subscription.created_date.desc())\
            .first()
        return db_subscription

    @classmethod
    def create(cls, subscription: dict, session=None) -> Subscription:
        """Create a subscription."""
        new_subscription = Subscription(
            engagement_id=subscription.get('engagement_id', None),
            participant_id=subscription.get('participant_id', None),
            is_subscribed=subscription.get('is_subscribed', False),
            project_id=subscription.get('project_id', None),
            type=subscription.get('type', None),
            created_date=datetime.utcnow(),
            created_by=subscription.get('created_by', None),
        )
        db.session.add(new_subscription)
        if session is None:
            db.session.commit()
        else:
            session.flush()
        return new_subscription

    @classmethod
    def update_subscription_for_participant(cls, subscription: dict, session=None) -> Subscription:
        """Update subscription for a participant."""
        update_fields = {
            'is_subscribed': subscription.get('is_subscribed', False),
            'updated_date': datetime.utcnow(),
            'updated_by': subscription.get('updated_by', None),
        }
        participant_id = subscription.get('participant_id', None)
        query = Subscription.query.filter_by(participant_id=participant_id)
        record = query.first()
        if not record:
            raise ValueError('Subscription Not Found')
        query.update(update_fields)
        if session is None:
            db.session.commit()
        return query.first()

    @classmethod
    def update_subscription_for_participant_eng(cls, subscription: dict, session=None) -> Subscription:
        """Update subscription for a participant and engagement."""
        update_fields = {
            'is_subscribed': subscription.get('is_subscribed', False),
            'updated_date': datetime.utcnow(),
            'updated_by': subscription.get('updated_by', None),
        }
        participant_id = subscription.get('participant_id', None)
        engagement_id = subscription.get('engagement_id', None)
        query = Subscription.query.filter_by(participant_id=participant_id, engagement_id=engagement_id)
        record = query.first()
        if not record:
            raise ValueError('Subscription Not Found')
        query.update(update_fields)
        if session is None:
            db.session.commit()
        return query.first()

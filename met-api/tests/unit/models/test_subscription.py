"""Tests for the Subscription model.

Test suite to ensure that the Subscription model routines are working as expected.
"""
import pytest

from met_api.constants.subscription_type import SubscriptionType
from met_api.models.participant import Participant as ParticipantModel
from met_api.models.subscription import Subscription as SubscriptionModel
from tests.utilities.factory_utils import factory_participant_model


ENGAGEMENT_ID = 9101
OTHER_ENGAGEMENT_ID = 9102


def _subscription(participant, subscription_type, engagement_id=None, project_id=None, is_subscribed=True):
    subscription = SubscriptionModel(participant_id=participant.id if participant else None,
                                     type=subscription_type, engagement_id=engagement_id,
                                     project_id=project_id, is_subscribed=is_subscribed)
    subscription.save()
    return subscription


@pytest.mark.parametrize('has_metadata, project_id, project_rows', [
    (True, 'p1', ['project p1']),
    (True, None, ['project without id']),
    (False, None, []),
], ids=['metadata with project', 'metadata without project id', 'no metadata'])
def test_confirmed_subscriptions_for_engagement(session, has_metadata, project_id,
                                                project_rows):  # pylint:disable=unused-argument
    """Only confirmed subscriptions that match the engagement come back, joined to their participant."""
    participant = factory_participant_model()
    without_address = ParticipantModel(email_address=None)
    without_address.save()
    rows = {
        'engagement': _subscription(participant, SubscriptionType.ENGAGEMENT, engagement_id=ENGAGEMENT_ID),
        'other engagement': _subscription(participant, SubscriptionType.ENGAGEMENT,
                                          engagement_id=OTHER_ENGAGEMENT_ID),
        'project p1': _subscription(participant, SubscriptionType.PROJECT, project_id='p1'),
        'project p2': _subscription(participant, SubscriptionType.PROJECT, project_id='p2'),
        'project without id': _subscription(participant, SubscriptionType.PROJECT),
        'tenant': _subscription(participant, SubscriptionType.TENANT),
        'tenant unsubscribed': _subscription(participant, SubscriptionType.TENANT, is_subscribed=False),
        'no type': _subscription(participant, None),
        'tenant without participant': _subscription(None, SubscriptionType.TENANT),
        'tenant without address': _subscription(without_address, SubscriptionType.TENANT),
    }
    created_ids = {subscription.id for subscription in rows.values()}

    found = SubscriptionModel.get_confirmed_for_engagement(ENGAGEMENT_ID, has_metadata, project_id)

    expected = ['engagement', 'tenant', 'tenant without participant', 'tenant without address'] + project_rows
    assert {(row.subscription_id, row.participant_id, row.email_address)
            for row in found if row.subscription_id in created_ids} == {
        (rows[name].id, rows[name].participant_id, ParticipantModel.find_by_id(rows[name].participant_id).email_address)
        if rows[name].participant_id else (rows[name].id, None, None)
        for name in expected
    }

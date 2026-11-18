"""Tests for the Subscription model.

Test suite to ensure that the Subscription model routines are working as expected.
"""
import pytest

from met_api.constants.subscription_type import SubscriptionType
from met_api.models.participant import Participant as ParticipantModel
from met_api.models.subscription import Subscription as SubscriptionModel
from tests.utilities.factory_scenarios import TestTenantInfo
from tests.utilities.factory_utils import factory_engagement_model, factory_participant_model, factory_tenant_model


ENGAGEMENT_ID = 9101
OTHER_ENGAGEMENT_ID = 9102
MISSING_ENGAGEMENT_ID = 9199


def _engagement_in(tenant):
    engagement = factory_engagement_model()
    engagement.tenant_id = tenant.id
    engagement.save()
    return engagement


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


def test_tenant_subscriptions_match_only_their_own_tenant(session):  # pylint:disable=unused-argument
    """A tenant subscription matches engagements of its own tenant, or every engagement when its tenant is unknown."""
    tenant = factory_tenant_model()
    other_tenant = factory_tenant_model(TestTenantInfo.tenant2)
    target = _engagement_in(tenant)
    participant = factory_participant_model()
    rows = {
        'same tenant': _subscription(participant, SubscriptionType.TENANT,
                                     engagement_id=_engagement_in(tenant).id),
        'other tenant': _subscription(participant, SubscriptionType.TENANT,
                                      engagement_id=_engagement_in(other_tenant).id),
        'no engagement': _subscription(participant, SubscriptionType.TENANT),
        'missing engagement': _subscription(participant, SubscriptionType.TENANT,
                                            engagement_id=MISSING_ENGAGEMENT_ID),
    }
    names = {subscription.id: name for name, subscription in rows.items()}

    found = SubscriptionModel.get_confirmed_for_engagement(target.id, False, None)

    assert {names[row.subscription_id] for row in found if row.subscription_id in names} == {
        'same tenant', 'no engagement', 'missing engagement'}

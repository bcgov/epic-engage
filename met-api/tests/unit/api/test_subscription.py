# Copyright © 2019 Province of British Columbia
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Tests to verify the Subscription API end-point.

Test-Suite to ensure that the subscription endpoint is working as expected.
"""
import json

from met_api.services.email_verification_service import EmailVerificationService
from met_api.utils.enums import ContentType
from tests.utilities.factory_scenarios import TestJwtClaims
from tests.utilities.factory_utils import (
    factory_auth_header, factory_participant_model, factory_subscription_model, factory_subscription_model_with_ids,
    factory_survey_and_eng_model, set_global_tenant, setup_participant_and_engagement)


def test_create_subscription(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that an Email can be sent."""
    claims = TestJwtClaims.public_user_role
    set_global_tenant()
    survey, eng = factory_survey_and_eng_model()
    participant = factory_participant_model()
    to_dict = {
        'engagement_id': eng.id,
        'participant_id': participant.id,
        'is_subscribed': True,
    }
    headers = factory_auth_header(jwt=jwt, claims=claims)
    rv = client.post('/api/subscription/', data=json.dumps(to_dict),
                     headers=headers, content_type=ContentType.JSON.value)

    assert rv.status_code == 200


def test_update_subscription(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that an subscription can be updated."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.public_user_role)
    subscription = factory_subscription_model()
    subscription_participant_id = str(subscription.participant_id)

    subscription_edits = {
        'participant_id': subscription_participant_id,
        'is_subscribed': False,
    }

    rv = client.patch('/api/subscription/', data=json.dumps(subscription_edits),
                      headers=headers, content_type=ContentType.JSON.value)

    assert rv.status_code == 200


def test_unsubscribe_by_token(client, jwt, session):
    """Test unsubscribing via secure token."""
    # Setup: participant, engagement, subscription, and token
    participant, engagement = setup_participant_and_engagement(session)
    factory_subscription_model_with_ids(participant.id, engagement.id)
    token = EmailVerificationService.create_unsubscribe_token(
        participant.id, engagement.id
    )

    rv = client.patch(
        f'/api/subscription/unsubscribe/{token}',
        json={'is_subscribed': False},
        content_type='application/json'
    )

    assert rv.status_code == 200
    assert rv.json['is_subscribed'] is False
    assert rv.json['engagement_id'] == engagement.id


def test_resubscribe_by_token(client, jwt, session):
    """Test re-subscribing via same token."""
    # Setup and unsubscribe first
    participant, engagement = setup_participant_and_engagement(session)
    factory_subscription_model_with_ids(participant.id, engagement.id)
    token = EmailVerificationService.create_unsubscribe_token(
        participant.id, engagement.id
    )

    rv = client.patch(
        f'/api/subscription/unsubscribe/{token}',
        json={'is_subscribed': False},
        content_type='application/json'
    )

    rv = client.patch(
        f'/api/subscription/unsubscribe/{token}',
        json={'is_subscribed': True},
        content_type='application/json'
    )

    assert rv.status_code == 200
    assert rv.json['is_subscribed'] is True


def test_unsubscribe_invalid_token(client, session):
    """Test unsubscribe with invalid token returns 400."""
    rv = client.patch(
        '/api/subscription/unsubscribe/invalid-uuid-token',
        json={'is_subscribed': False},
        content_type='application/json'
    )

    assert rv.status_code == 400
    assert 'Invalid unsubscribe token' in rv.json['message']

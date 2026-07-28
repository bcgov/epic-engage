# Copyright © 2021 Province of British Columbia
#
# Licensed under the Apache License, Version 2.0 (the 'License');
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an 'AS IS' BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""API endpoints for managing a subscription resource."""

from http import HTTPStatus

from flask import current_app, request
from flask_cors import cross_origin
from flask_restx import Namespace, Resource

from met_api.auth import jwt as _jwt
from met_api.services.email_verification_service import EmailVerificationService
from met_api.services.subscription_service import SubscriptionService
from met_api.utils.limiter import limiter, public_write_limit
from met_api.utils.util import allowedorigins, cors_preflight


API = Namespace('subscription', description='Endpoints for Subscription Management')
"""Custom exception messages
"""


@cors_preflight('GET, OPTIONS')
@API.route('/<participant_id>')
class Subscription(Resource):
    """Resource for managing subscription."""

    @staticmethod
    # @TRACER.trace()
    @cross_origin(origins=allowedorigins())
    @_jwt.requires_auth
    def get(participant_id):
        """Fetch a subscription matching the provided participant id."""
        try:
            subscription = SubscriptionService().get(participant_id)
            if subscription:
                return subscription, HTTPStatus.OK

            return 'Subscription not found', HTTPStatus.NOT_FOUND
        except KeyError:
            return 'Subscription not found', HTTPStatus.INTERNAL_SERVER_ERROR
        except ValueError as err:
            current_app.logger.error('Error fetching subscription: %s', err)
            return 'Error fetching subscription', HTTPStatus.INTERNAL_SERVER_ERROR


@cors_preflight('POST, PATCH, OPTIONS')
@API.route('/')
class Subscriptions(Resource):
    """Resource for managing subscription."""

    @staticmethod
    # @TRACER.trace()
    @cross_origin(origins=allowedorigins())
    @limiter.limit(public_write_limit)
    def post():
        """Create a new subscription."""
        try:
            request_json = request.get_json()
            SubscriptionService().create_subscription(request_json)
            return {}, HTTPStatus.OK
        except (KeyError, ValueError) as err:
            current_app.logger.error('Error creating subscription: %s', err)
            return 'Error creating subscription', HTTPStatus.INTERNAL_SERVER_ERROR

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @limiter.limit(public_write_limit)
    def patch():
        """Update a existing subscription partially."""
        try:
            request_json = request.get_json()
            SubscriptionService().update_subscription_for_participant(request_json)
            return {}, HTTPStatus.OK
        except (KeyError, ValueError) as err:
            current_app.logger.error('Error updating subscription: %s', err)
            return 'Error updating subscription', HTTPStatus.INTERNAL_SERVER_ERROR


@cors_preflight('POST, OPTIONS')
@API.route('/manage')
class ManageSubscriptions(Resource):
    """Resource for managing subscription."""

    @staticmethod
    # @TRACER.trace()
    @cross_origin(origins=allowedorigins())
    @limiter.limit(public_write_limit)
    def post():
        """Create or update a subscription."""
        try:
            request_json = request.get_json()
            SubscriptionService().create_or_update_subscription(request_json)
            return {}, HTTPStatus.OK
        except (KeyError, ValueError) as err:
            current_app.logger.error('Error creating/updating subscription: %s', err)
            return 'Error creating/updating subscription', HTTPStatus.INTERNAL_SERVER_ERROR

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @limiter.limit(public_write_limit)
    def patch():
        """Update a existing subscription partially."""
        try:
            request_json = request.get_json()
            SubscriptionService().update_subscription_for_participant_eng(request_json)
            return {}, HTTPStatus.OK
        except (KeyError, ValueError) as err:
            current_app.logger.error('Error updating subscription: %s', err)
            return 'Error updating subscription', HTTPStatus.INTERNAL_SERVER_ERROR


@cors_preflight('PATCH, OPTIONS')
@API.route('/unsubscribe/<token>')
class UnsubscribeByToken(Resource):
    """Resource for secure token-based subscription management."""

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @limiter.limit(public_write_limit)
    def patch(token):
        """Update subscription status using a secure token.

        This endpoint validates the unsubscribe token and updates the subscription
        for the specific engagement associated with that token. The token remains
        active to allow toggling between subscribed/unsubscribed states.
        """
        try:
            # Validate token and get participant/engagement context
            email_verification = EmailVerificationService.get_unsubscribe_verification(token)
            participant_id = email_verification.get('participant_id')
            engagement_id = email_verification.get('engagement_id')

            # Get desired subscription state from request body
            request_json = request.get_json() or {}
            is_subscribed = request_json.get('is_subscribed', False)

            # Update subscription for this specific engagement
            subscription_data = {
                'participant_id': participant_id,
                'engagement_id': engagement_id,
                'is_subscribed': is_subscribed,
            }
            result = SubscriptionService.update_subscription_for_participant_eng(subscription_data)

            return {
                'is_subscribed': result.get('is_subscribed', False),
                'engagement_id': engagement_id,
            }, HTTPStatus.OK

        except ValueError as err:
            return {'message': str(err)}, HTTPStatus.BAD_REQUEST

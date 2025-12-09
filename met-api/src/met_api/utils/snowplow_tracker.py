# Copyright © 2021-2025 Province of British Columbia
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
"""Snowplow analytics tracker for server-side event tracking.

This module provides server-side Snowplow analytics tracking to complement
the frontend tracking and avoid ad-blocker interference. It tracks backend
events when frontend actions trigger API calls.
"""

import logging
from typing import Any, Dict, Optional

from flask import current_app, g, request
from snowplow_tracker import Emitter, SelfDescribingJson, Subject, Tracker

from met_api.utils.analytics import AnalyticsEvent, BaseAnalyticsProvider


logger = logging.getLogger(__name__)


class SnowplowTracker(BaseAnalyticsProvider):
    """Snowplow analytics provider with server-side event tracking."""

    _instance: Optional['SnowplowTracker'] = None
    _tracker: Optional[Tracker] = None
    _enabled: bool = False

    def __new__(cls):
        """Ensure only one instance of SnowplowTracker exists."""
        if cls._instance is None:
            cls._instance = super(SnowplowTracker, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize the Snowplow tracker if not already initialized."""
        if self._tracker is None:
            self._initialize_tracker()

    def initialize(self, config: Dict[str, Any]) -> bool:
        """Initialize the Snowplow tracker (BaseAnalyticsProvider interface).

        Args:
            config: Configuration dictionary with keys:
                - enabled: bool
                - collector: str (optional, reads from Flask config)
                - app_id: str (optional, reads from Flask config)
                - namespace: str (optional, reads from Flask config)

        Returns:
            bool: True if initialization successful
        """
        try:
            self._enabled = config.get('enabled', False)

            if not self._enabled:
                logger.info('Snowplow analytics provider is disabled')
                return True

            # Override config for testing/manual initialization
            self._manual_config = config
            self._initialize_tracker()
            logger.info('Snowplow analytics provider initialized')
            return True

        except Exception as e:
            logger.error(f'Failed to initialize Snowplow provider: {e}', exc_info=True)
            self._enabled = False
            return False

    def _initialize_tracker(self):
        """Initialize the Snowplow tracker with configuration from Flask app."""
        try:
            # Check for manual config first (for testing), then Flask app
            manual_config = getattr(self, '_manual_config', None)

            if manual_config:
                self._enabled = manual_config.get('enabled', False)
            else:
                self._enabled = current_app.config.get('SNOWPLOW_ENABLED', False)

            if not self._enabled:
                logger.info('Snowplow tracking is disabled')
                return

            # Get config from manual config first (for testing), then Flask app
            if manual_config:
                collector_uri = manual_config.get('collector')
                namespace = manual_config.get('namespace', 'met-api')
                app_id = manual_config.get('app_id', 'Snowplow_standalone_MET')
            else:
                collector_uri = current_app.config.get('SNOWPLOW_COLLECTOR')
                namespace = current_app.config.get('SNOWPLOW_NAMESPACE', 'met-api')
                app_id = current_app.config.get('SNOWPLOW_APP_ID', 'Snowplow_standalone_MET')

            if not collector_uri:
                logger.warning('SNOWPLOW_COLLECTOR not configured. Tracking disabled.')
                self._enabled = False
                return

            # Create emitter (sends events to collector)
            # Use GET for simple events, batch_size=1 for immediate sending
            emitter = Emitter(
                collector_uri,
                protocol='https',
                method='post',
                batch_size=1,
                on_failure=self._on_failure
            )

            # Create tracker
            self._tracker = Tracker(
                emitters=emitter,
                namespace=namespace,
                app_id=app_id,
                encode_base64=True
            )

            logger.info(f'Snowplow tracker initialized: collector={collector_uri}, app_id={app_id}')

        except Exception as e:
            logger.error(f'Failed to initialize Snowplow tracker: {str(e)}', exc_info=True)
            self._enabled = False
            self._tracker = None

    @staticmethod
    def _on_failure(num_ok: int, failures: list):
        """Handle failed event sends."""
        logger.warning(f'Snowplow event send failure: {num_ok} succeeded, {len(failures)} failed')
        for failure in failures:
            logger.debug(f'Failed event: {failure}')

    def _create_subject(self) -> Optional[Subject]:
        """Create a Subject with user context from the request."""
        try:
            subject = Subject()

            # Add IP address if available
            if request and hasattr(request, 'remote_addr'):
                subject.set_ip_address(request.remote_addr)

            # Add user agent if available
            if request and hasattr(request, 'user_agent'):
                user_agent = request.user_agent.string
                if user_agent:
                    subject.set_useragent(user_agent)

            # Add user ID from JWT token if available
            token_info = g.get('token_info', {})
            if token_info:
                user_id = token_info.get('sub') or token_info.get('preferred_username')
                if user_id:
                    subject.set_user_id(user_id)

            return subject

        except Exception as e:
            logger.warning(f'Failed to create Snowplow subject: {str(e)}')
            return None

    def _get_context_entities(self) -> list:
        """Build context entities from Flask request and app context."""
        contexts = []

        try:
            # Add tenant context if available
            tenant_name = g.get('tenant_name')
            tenant_id = g.get('tenant_id')
            if tenant_name or tenant_id:
                tenant_context = SelfDescribingJson(
                    'iglu:ca.bc.gov.met/tenant/jsonschema/1-0-0',
                    {
                        'tenant_short_name': tenant_name,
                        'tenant_id': tenant_id
                    }
                )
                contexts.append(tenant_context)

            # Add JWT token context if available (roles, etc.)
            token_info = g.get('token_info', {})
            if token_info:
                # Extract relevant JWT claims
                jwt_context = SelfDescribingJson(
                    'iglu:ca.bc.gov.met/jwt_context/jsonschema/1-0-0',
                    {
                        'user_id': token_info.get('sub'),
                        'username': token_info.get('preferred_username'),
                        'email': token_info.get('email'),
                        'roles': token_info.get('realm_access', {}).get('roles', [])[:10]  # Limit roles
                    }
                )
                contexts.append(jwt_context)

            # Add request context
            if request:
                request_context = SelfDescribingJson(
                    'iglu:ca.bc.gov.met/api_request/jsonschema/1-0-0',
                    {
                        'method': request.method,
                        'endpoint': request.endpoint,
                        'path': request.path,
                        'referrer': request.referrer
                    }
                )
                contexts.append(request_context)

        except Exception as e:
            logger.warning(f'Failed to build Snowplow contexts: {str(e)}')

        return contexts

    def track_self_describing_event(
        self,
        schema: str,
        data: Dict[str, Any],
        context: Optional[list] = None
    ) -> bool:
        """Track a self-describing event with optional context.

        Args:
            schema: The Iglu schema URI (e.g., 'iglu:ca.bc.gov.met/submit-survey/jsonschema/1-0-0')
            data: The event data dictionary matching the schema
            context: Optional list of SelfDescribingJson context entities

        Returns:
            bool: True if tracking succeeded or is disabled, False if an error occurred
        """
        if not self._enabled or not self._tracker:
            return True  # Don't block execution if tracking is disabled

        try:
            # Create event JSON
            event_json = SelfDescribingJson(schema, data)

            # Build context entities
            contexts = context or []
            contexts.extend(self._get_context_entities())

            # Create subject with user info
            subject = self._create_subject()

            # Track the event
            self._tracker.track_self_describing_event(
                event_json,
                context=contexts if contexts else None,
                subject=subject
            )

            logger.debug(f'Tracked Snowplow event: schema={schema}, data={data}')
            return True

        except Exception as e:
            logger.error(f'Failed to track Snowplow event: {str(e)}', exc_info=True)
            return False

    def track_struct_event(
        self,
        category: str,
        action: str,
        label: Optional[str] = None,
        property_: Optional[str] = None,
        value: Optional[float] = None,
        context: Optional[list] = None
    ) -> bool:
        """Track a structured event.

        Args:
            category: The event category (e.g., 'survey', 'engagement')
            action: The event action (e.g., 'submit', 'verify')
            label: Optional event label
            property_: Optional event property
            value: Optional numeric value
            context: Optional list of SelfDescribingJson context entities

        Returns:
            bool: True if tracking succeeded or is disabled, False if an error occurred
        """
        if not self._enabled or not self._tracker:
            return True

        try:
            # Build context entities
            contexts = context or []
            contexts.extend(self._get_context_entities())

            # Create subject with user info
            subject = self._create_subject()

            # Track the event
            self._tracker.track_struct_event(
                category=category,
                action=action,
                label=label,
                property_=property_,
                value=value,
                context=contexts if contexts else None,
                subject=subject
            )

            logger.debug(f'Tracked structured event: {category}/{action}')
            return True

        except Exception as e:
            logger.error(f'Failed to track structured event: {str(e)}', exc_info=True)
            return False

    def track_survey_submission(
        self,
        survey_id: int,
        engagement_id: int,
        submission_id: Optional[int] = None,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track a survey submission event (matches frontend schema).

        Args:
            survey_id: The survey ID
            engagement_id: The engagement ID
            submission_id: Optional submission ID
            properties: Optional additional context data

        Returns:
            bool: True if tracking succeeded
        """
        additional_context = properties
        data = {
            'survey_id': survey_id,
            'engagement_id': engagement_id
        }

        if submission_id:
            data['submission_id'] = submission_id

        if additional_context:
            data.update(additional_context)

        return self.track_self_describing_event(
            'iglu:ca.bc.gov.met/submit-survey/jsonschema/1-0-0',
            data
        )

    def track_email_verification(
        self,
        survey_id: int,
        engagement_id: int,
        verification_type: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track an email verification event (matches frontend schema).

        Args:
            survey_id: The survey ID
            engagement_id: The engagement ID
            verification_type: Optional verification type (e.g., 'survey', 'subscribe')
            properties: Optional additional context data

        Returns:
            bool: True if tracking succeeded
        """
        additional_context = properties
        data = {
            'survey_id': survey_id,
            'engagement_id': engagement_id
        }

        if verification_type:
            data['verification_type'] = verification_type

        if additional_context:
            data.update(additional_context)

        return self.track_self_describing_event(
            'iglu:ca.bc.gov.met/verify-email/jsonschema/1-0-0',
            data
        )

    def track_api_error(
        self,
        error_type: str,
        error_message: str,
        endpoint: Optional[str] = None,
        status_code: Optional[int] = None
    ) -> bool:
        """Track an API error event.

        Args:
            error_type: The type/class of error
            error_message: The error message
            endpoint: Optional API endpoint where error occurred
            status_code: Optional HTTP status code

        Returns:
            bool: True if tracking succeeded
        """
        data = {
            'error_type': error_type,
            'error_message': error_message[:500],  # Limit message length
            'endpoint': endpoint or (request.endpoint if request else None),
            'status_code': status_code
        }

        return self.track_self_describing_event(
            'iglu:ca.bc.gov.met/api_error/jsonschema/1-0-0',
            data
        )

    def track_event(self, event: AnalyticsEvent) -> bool:
        """Track a generic analytics event (BaseAnalyticsProvider interface).

        Args:
            event: The analytics event to track

        Returns:
            bool: True if tracking successful
        """
        if not self._enabled or not self._tracker:
            return True

        try:
            # Map generic event to Snowplow structured event
            if event.category and event.action:
                return self.track_struct_event(
                    category=event.category,
                    action=event.action,
                    label=event.label,
                    property_=event.event_type,
                    value=event.value
                )
            else:
                # If no category/action, log a warning
                logger.warning(f'Generic event {event.event_type} has no category/action for Snowplow')
                return True

        except Exception as e:
            logger.error(f'Error tracking event in Snowplow: {e}')
            return False

    def track_page_view(
        self,
        page_path: str,
        page_title: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track a page view event (BaseAnalyticsProvider interface).

        Note: Snowplow page views are typically tracked client-side.
        This maps to a structured event for backend-generated pages.

        Args:
            page_path: The page path
            page_title: Optional page title
            properties: Optional additional properties

        Returns:
            bool: True if tracking successful
        """
        if not self._enabled or not self._tracker:
            return True

        try:
            # Track as structured event since backend page views are less common
            return self.track_struct_event(
                category='page',
                action='view',
                label=page_path,
                property_='backend_page_view'
            )
        except Exception as e:
            logger.error(f'Error tracking page view in Snowplow: {e}')
            return False

    def track_error(
        self,
        error_type: str,
        error_message: str,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track an error event (BaseAnalyticsProvider interface).

        Args:
            error_type: The type/class of error
            error_message: The error message
            properties: Optional additional properties (endpoint, status_code, etc.)

        Returns:
            bool: True if tracking successful
        """
        if not self._enabled or not self._tracker:
            return True

        try:
            endpoint = properties.get('endpoint') if properties else None
            status_code = properties.get('status_code') if properties else None

            return self.track_api_error(
                error_type=error_type,
                error_message=error_message,
                endpoint=endpoint,
                status_code=status_code
            )
        except Exception as e:
            logger.error(f'Error tracking error in Snowplow: {e}')
            return False

    def is_enabled(self) -> bool:
        """Check if the Snowplow provider is enabled (BaseAnalyticsProvider interface).

        Returns:
            bool: True if enabled
        """
        return self._enabled and self._tracker is not None


# Singleton instance
_tracker_instance: Optional[SnowplowTracker] = None


def get_tracker() -> SnowplowTracker:
    """Get or create the Snowplow tracker singleton instance.

    Returns:
        SnowplowTracker: The tracker instance
    """
    global _tracker_instance
    if _tracker_instance is None:
        _tracker_instance = SnowplowTracker()
    return _tracker_instance


# Convenience functions for common tracking operations

def track_survey_submission(
    survey_id: int,
    engagement_id: int,
    submission_id: Optional[int] = None,
    additional_context: Optional[Dict[str, Any]] = None
) -> bool:
    """Track a survey submission event."""
    try:
        tracker = get_tracker()
        return tracker.track_survey_submission(
            survey_id, engagement_id, submission_id, additional_context
        )
    except Exception as e:
        logger.error(f'Error tracking survey submission: {str(e)}')
        return False


def track_email_verification(
    survey_id: int,
    engagement_id: int,
    verification_type: Optional[str] = None,
    additional_context: Optional[Dict[str, Any]] = None
) -> bool:
    """Track an email verification event."""
    try:
        tracker = get_tracker()
        return tracker.track_email_verification(
            survey_id, engagement_id, verification_type, additional_context
        )
    except Exception as e:
        logger.error(f'Error tracking email verification: {str(e)}')
        return False


def track_api_error(
    error_type: str,
    error_message: str,
    endpoint: Optional[str] = None,
    status_code: Optional[int] = None
) -> bool:
    """Track an API error event."""
    try:
        tracker = get_tracker()
        return tracker.track_api_error(error_type, error_message, endpoint, status_code)
    except Exception as e:
        logger.error(f'Error tracking API error: {str(e)}')
        return False

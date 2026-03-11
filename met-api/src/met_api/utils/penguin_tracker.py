# Copyright © 2021-2026 Province of British Columbia
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
"""Penguin Analytics tracker for server-side event tracking.

This module provides server-side Penguin Analytics tracking to track events
from the backend that have access to data not available on the frontend
(e.g., verification_token for email_submitted events).

Session continuity is maintained by reading the X-Analytics-Session-Id header
from incoming requests, which the frontend includes with all API calls.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import requests
from flask import current_app, request

from met_api.utils.analytics import AnalyticsEvent, BaseAnalyticsProvider


logger = logging.getLogger(__name__)

# Header name for session ID passed from frontend
ANALYTICS_SESSION_HEADER = 'X-Analytics-Session-Id'


class PenguinTracker(BaseAnalyticsProvider):
    """Penguin Analytics provider with server-side event tracking.

    This provider sends events directly to the Penguin Analytics API.
    It reads the browser's session ID from request headers to maintain
    session continuity with frontend-tracked events.
    """

    _instance: Optional['PenguinTracker'] = None
    _enabled: bool = False
    _api_url: Optional[str] = None
    _source_app: str = 'met-web'
    _timeout: int = 5  # seconds

    def __new__(cls):
        """Ensure only one instance of PenguinTracker exists."""
        if cls._instance is None:
            cls._instance = super(PenguinTracker, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize placeholder - actual init happens in initialize()."""
        pass

    def initialize(self, config: Dict[str, Any]) -> bool:
        """Initialize the Penguin Analytics tracker.

        Args:
            config: Configuration dictionary with keys:
                - enabled: bool - whether tracking is enabled
                - api_url: str - Penguin Analytics API endpoint
                - source_app: str - source application identifier

        Returns:
            bool: True if initialization successful
        """
        try:
            self._enabled = config.get('enabled', False)

            if not self._enabled:
                logger.info('Penguin Analytics provider is disabled')
                return True

            self._api_url = config.get('api_url')
            self._source_app = config.get('source_app', 'met-web')

            if not self._api_url:
                logger.warning('PENGUIN_ANALYTICS_URL not configured. Tracking disabled.')
                self._enabled = False
                return True

            logger.info(f'Penguin Analytics tracker initialized: url={self._api_url}, source_app={self._source_app}')
            return True

        except Exception as e:
            logger.error(f'Failed to initialize Penguin Analytics tracker: {e}', exc_info=True)
            self._enabled = False
            return False

    def is_enabled(self) -> bool:
        """Check if the provider is enabled."""
        return self._enabled

    def _get_session_id(self) -> str:
        """Get session ID from request header or generate a fallback.

        Returns the browser's session ID from the X-Analytics-Session-Id header
        if present, otherwise generates a new UUID for this request.

        Returns:
            str: Session ID (UUID format)
        """
        try:
            if request:
                session_id = request.headers.get(ANALYTICS_SESSION_HEADER)
                if session_id:
                    return session_id
        except RuntimeError:
            # Outside request context
            pass

        # Fallback: generate UUID for this event
        # This happens when called outside of a request context or when
        # the frontend didn't send the header
        return str(uuid.uuid4())

    def _send_event(
        self,
        event_type: str,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Send an event to Penguin Analytics API.

        Args:
            event_type: The event type/name (e.g., 'email_submitted')
            properties: Optional event properties

        Returns:
            bool: True if event was sent successfully
        """
        if not self._enabled or not self._api_url:
            return True

        try:
            payload = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'eventType': event_type,
                'sessionId': self._get_session_id(),
                'sourceApp': self._source_app,
                'properties': properties or {}
            }

            response = requests.post(
                self._api_url,
                json=payload,
                timeout=self._timeout,
                headers={'Content-Type': 'application/json'}
            )

            if response.ok:
                logger.debug(f'Penguin Analytics event sent: {event_type}')
                return True
            else:
                logger.warning(
                    f'Penguin Analytics event failed: {event_type}, '
                    f'status={response.status_code}, response={response.text[:200]}'
                )
                return False

        except requests.exceptions.Timeout:
            logger.warning(f'Penguin Analytics timeout sending event: {event_type}')
            return False
        except requests.exceptions.RequestException as e:
            logger.warning(f'Penguin Analytics request error: {event_type}, error={e}')
            return False
        except Exception as e:
            logger.error(f'Penguin Analytics unexpected error: {event_type}, error={e}')
            return False

    def track_event(self, event: AnalyticsEvent) -> bool:
        """Track a generic analytics event.

        Args:
            event: The analytics event to track

        Returns:
            bool: True if tracking successful
        """
        if not self._enabled:
            return True

        properties = {
            'category': event.category,
            'action': event.action,
            'label': event.label,
            'value': event.value,
            **event.properties
        }

        return self._send_event(event.event_type, properties)

    def track_email_verification(
        self,
        survey_id: int,
        engagement_id: int,
        verification_type: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track an email verification/submission event.

        This is the key method for tracking email_submitted events with
        the verification_token, which is only available server-side.

        Args:
            survey_id: The survey ID
            engagement_id: The engagement ID
            verification_type: Type of verification (e.g., 'survey', 'subscribe')
            properties: Additional properties including verification_token, participant_id

        Returns:
            bool: True if tracking successful
        """
        if not self._enabled:
            return True

        event_properties = {
            'engagement_id': str(engagement_id),
            'survey_id': str(survey_id),
        }

        if verification_type:
            event_properties['verification_type'] = verification_type

        # Merge additional properties, converting to strings where needed
        if properties:
            for key, value in properties.items():
                if value is not None:
                    event_properties[key] = str(value) if key in ('verification_token', 'participant_id') else value

        return self._send_event('email_submitted', event_properties)

    def track_survey_submission(
        self,
        survey_id: int,
        engagement_id: int,
        submission_id: Optional[int] = None,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track a survey submission event.

        Note: Survey submissions are typically tracked on the frontend.
        """
        if not self._enabled:
            return True

        event_properties = {
            'engagement_id': str(engagement_id),
            'survey_id': str(survey_id),
            **(({'submission_id': str(submission_id)} if submission_id else {})),
            **(properties or {})
        }

        return self._send_event('survey_submit', event_properties)

    def track_page_view(
        self,
        page_path: str,
        page_title: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track a page view event.

        Note: Page views are typically tracked on the frontend.
        """
        if not self._enabled:
            return True

        event_properties = {
            'path': page_path,
            **(({'page_title': page_title} if page_title else {})),
            **(properties or {})
        }

        return self._send_event('Page Viewed', event_properties)

    def track_error(
        self,
        error_type: str,
        error_message: str,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track an error event."""
        if not self._enabled:
            return True

        event_properties = {
            'error_type': error_type,
            'error_message': error_message[:500],  # Limit length
            **(properties or {})
        }

        return self._send_event('error', event_properties)


# Module-level convenience functions

def get_penguin_tracker() -> PenguinTracker:
    """Get the singleton PenguinTracker instance."""
    return PenguinTracker()


def track_email_verification(
    survey_id: int,
    engagement_id: int,
    verification_type: Optional[str] = None,
    properties: Optional[Dict[str, Any]] = None
) -> bool:
    """Track an email verification event.

    Convenience function that delegates to the singleton tracker.
    """
    tracker = get_penguin_tracker()
    return tracker.track_email_verification(
        survey_id, engagement_id, verification_type, properties
    )

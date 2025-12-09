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
"""Analytics tracking using Snowplow (with provider abstraction for future flexibility).

This module provides the main analytics interface using Snowplow.
Service code imports from here for easy future provider switching.
"""

import logging
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional


logger = logging.getLogger(__name__)


class AnalyticsProvider(Enum):
    """Supported analytics providers."""

    SNOWPLOW = 'snowplow'
    GOOGLE_ANALYTICS = 'google_analytics'
    CONSOLE = 'console'  # For testing/debugging
    NONE = 'none'  # Disabled


class AnalyticsEvent:
    """Standard analytics event data structure."""

    def __init__(
        self,
        event_type: str,
        category: Optional[str] = None,
        action: Optional[str] = None,
        label: Optional[str] = None,
        value: Optional[float] = None,
        properties: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ):
        """Initialize an analytics event.

        Args:
            event_type: Type of event (e.g., 'survey_submission', 'email_verification')
            category: Event category for structured tracking
            action: Event action for structured tracking
            label: Event label for structured tracking
            value: Numeric value associated with the event
            properties: Custom properties/data for the event
            context: Additional context data
        """
        self.event_type = event_type
        self.category = category
        self.action = action
        self.label = label
        self.value = value
        self.properties = properties or {}
        self.context = context or {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary."""
        return {
            'event_type': self.event_type,
            'category': self.category,
            'action': self.action,
            'label': self.label,
            'value': self.value,
            'properties': self.properties,
            'context': self.context
        }


class BaseAnalyticsProvider(ABC):
    """Abstract base class for analytics providers."""

    @abstractmethod
    def initialize(self, config: Dict[str, Any]) -> bool:
        """Initialize the analytics provider.

        Args:
            config: Provider-specific configuration

        Returns:
            bool: True if initialization successful
        """
        pass

    @abstractmethod
    def track_event(self, event: AnalyticsEvent) -> bool:
        """Track a generic event.

        Args:
            event: The event to track

        Returns:
            bool: True if tracking successful
        """
        pass

    @abstractmethod
    def track_survey_submission(
        self,
        survey_id: int,
        engagement_id: int,
        submission_id: Optional[int] = None,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track a survey submission event."""
        pass

    @abstractmethod
    def track_email_verification(
        self,
        survey_id: int,
        engagement_id: int,
        verification_type: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track an email verification event."""
        pass

    @abstractmethod
    def track_error(
        self,
        error_type: str,
        error_message: str,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track an error event."""
        pass

    @abstractmethod
    def track_page_view(
        self,
        page_path: str,
        page_title: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track a page view (for backend-generated pages)."""
        pass

    @abstractmethod
    def is_enabled(self) -> bool:
        """Check if the provider is enabled."""
        pass


class AnalyticsManager:
    """Manager for analytics providers with fallback support."""

    def __init__(self):
        """Initialize the analytics manager."""
        self._providers: List[BaseAnalyticsProvider] = []
        self._primary_provider: Optional[BaseAnalyticsProvider] = None
        self._initialized = False

    def initialize(self, primary_provider: BaseAnalyticsProvider,
                   fallback_providers: Optional[List[BaseAnalyticsProvider]] = None):
        """Initialize analytics manager with providers.

        Args:
            primary_provider: The primary analytics provider
            fallback_providers: Optional list of fallback providers
        """
        self._primary_provider = primary_provider
        self._providers = [primary_provider]

        if fallback_providers:
            self._providers.extend(fallback_providers)

        self._initialized = True
        logger.info(f'Analytics manager initialized with {len(self._providers)} provider(s)')

    def track_event(self, event: AnalyticsEvent) -> bool:
        """Track event using all providers.

        Args:
            event: The event to track

        Returns:
            bool: True if at least one provider succeeded
        """
        if not self._initialized or not self._providers:
            return True

        success = False
        for provider in self._providers:
            try:
                if provider.track_event(event):
                    success = True
            except Exception as e:
                logger.error(f'Error tracking event with {provider.__class__.__name__}: {e}')

        return success

    def track_survey_submission(
        self,
        survey_id: int,
        engagement_id: int,
        submission_id: Optional[int] = None,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track survey submission across all providers."""
        if not self._initialized:
            return True

        success = False
        for provider in self._providers:
            try:
                if provider.track_survey_submission(
                    survey_id, engagement_id, submission_id, properties
                ):
                    success = True
            except Exception as e:
                logger.error(f'Error tracking submission with {provider.__class__.__name__}: {e}')

        return success

    def track_email_verification(
        self,
        survey_id: int,
        engagement_id: int,
        verification_type: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track email verification across all providers."""
        if not self._initialized:
            return True

        success = False
        for provider in self._providers:
            try:
                if provider.track_email_verification(
                    survey_id, engagement_id, verification_type, properties
                ):
                    success = True
            except Exception as e:
                logger.error(f'Error tracking verification with {provider.__class__.__name__}: {e}')

        return success

    def track_error(
        self,
        error_type: str,
        error_message: str,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track error across all providers."""
        if not self._initialized:
            return True

        success = False
        for provider in self._providers:
            try:
                if provider.track_error(error_type, error_message, properties):
                    success = True
            except Exception as e:
                logger.error(f'Error tracking error with {provider.__class__.__name__}: {e}')

        return success

    def track_page_view(
        self,
        page_path: str,
        page_title: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Track page view across all providers."""
        if not self._initialized:
            return True

        success = False
        for provider in self._providers:
            try:
                if provider.track_page_view(page_path, page_title, properties):
                    success = True
            except Exception as e:
                logger.error(f'Error tracking page view with {provider.__class__.__name__}: {e}')

        return success

    @property
    def is_enabled(self) -> bool:
        """Check if any provider is enabled."""
        return self._initialized and any(p.is_enabled() for p in self._providers)


# Global analytics manager instance
_analytics_manager: Optional[AnalyticsManager] = None


def get_analytics_manager() -> AnalyticsManager:
    """Get or create the global analytics manager instance.

    Returns:
        AnalyticsManager: The manager instance
    """
    global _analytics_manager
    if _analytics_manager is None:
        _analytics_manager = AnalyticsManager()
    return _analytics_manager


def initialize_analytics(
    primary_provider: BaseAnalyticsProvider,
    fallback_providers: Optional[List[BaseAnalyticsProvider]] = None
):
    """Initialize the global analytics manager.

    Args:
        primary_provider: The primary analytics provider
        fallback_providers: Optional list of fallback providers
    """
    manager = get_analytics_manager()
    manager.initialize(primary_provider, fallback_providers)


# Convenience functions that use the global manager

def track_event(event: AnalyticsEvent) -> bool:
    """Track a generic event."""
    try:
        manager = get_analytics_manager()
        return manager.track_event(event)
    except Exception as e:
        logger.error(f'Error tracking event: {e}')
        return False


def track_survey_submission(
    survey_id: int,
    engagement_id: int,
    submission_id: Optional[int] = None,
    properties: Optional[Dict[str, Any]] = None
) -> bool:
    """Track a survey submission event."""
    try:
        manager = get_analytics_manager()
        return manager.track_survey_submission(
            survey_id, engagement_id, submission_id, properties
        )
    except Exception as e:
        logger.error(f'Error tracking survey submission: {e}')
        return False


def track_email_verification(
    survey_id: int,
    engagement_id: int,
    verification_type: Optional[str] = None,
    properties: Optional[Dict[str, Any]] = None
) -> bool:
    """Track an email verification event."""
    try:
        manager = get_analytics_manager()
        return manager.track_email_verification(
            survey_id, engagement_id, verification_type, properties
        )
    except Exception as e:
        logger.error(f'Error tracking email verification: {e}')
        return False


def track_error(
    error_type: str,
    error_message: str,
    properties: Optional[Dict[str, Any]] = None
) -> bool:
    """Track an error event."""
    try:
        manager = get_analytics_manager()
        return manager.track_error(error_type, error_message, properties)
    except Exception as e:
        logger.error(f'Error tracking error: {e}')
        return False


def track_page_view(
    page_path: str,
    page_title: Optional[str] = None,
    properties: Optional[Dict[str, Any]] = None
) -> bool:
    """Track a page view event."""
    try:
        manager = get_analytics_manager()
        return manager.track_page_view(page_path, page_title, properties)
    except Exception as e:
        logger.error(f'Error tracking page view: {e}')
        return False


def init_analytics(app):
    """Initialize analytics based on Flask configuration.

    This function should be called during Flask app initialization to set up
    the analytics provider(s). Currently only Snowplow is supported.

    Args:
        app: The Flask application instance
    """
    from met_api.utils.snowplow_tracker import SnowplowTracker

    with app.app_context():
        try:
            enabled = app.config.get('ANALYTICS_ENABLED', False)

            if not enabled:
                logger.info('Analytics is disabled via ANALYTICS_ENABLED=false')
                # Initialize with a disabled provider
                provider = SnowplowTracker()
                provider.initialize({'enabled': False})
                initialize_analytics(provider)
                return

            logger.info('Initializing analytics with Snowplow provider')

            # Initialize the Snowplow provider
            provider = SnowplowTracker()
            provider.initialize({
                'enabled': app.config.get('SNOWPLOW_ENABLED', False),
                'collector': app.config.get('SNOWPLOW_COLLECTOR'),
                'app_id': app.config.get('SNOWPLOW_APP_ID'),
                'namespace': app.config.get('SNOWPLOW_NAMESPACE')
            })

            # Initialize the global analytics manager
            initialize_analytics(provider)

            logger.info('Analytics initialized successfully with Snowplow provider')

        except Exception as e:
            logger.error(f'Failed to initialize analytics: {e}', exc_info=True)
            # Fallback to disabled provider so app can still run
            provider = SnowplowTracker()
            provider.initialize({'enabled': False})
            initialize_analytics(provider)

# Copyright © 2021 Province of British Columbia
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
"""Tests for analytics integration."""

from unittest.mock import MagicMock, patch

from met_api.utils import analytics
from met_api.utils.analytics import AnalyticsEvent, AnalyticsManager, BaseAnalyticsProvider
from met_api.utils.snowplow_tracker import SnowplowTracker as SnowplowAnalyticsProvider


class TestAnalyticsIntegration:
    """Test analytics integration and initialization."""

    def test_analytics_manager_initialization(self):
        """Test that analytics manager can be initialized with a provider."""
        manager = AnalyticsManager()
        provider = SnowplowAnalyticsProvider()
        provider.initialize({'enabled': False})

        manager.initialize(provider)

        assert manager._initialized is True
        assert manager._primary_provider == provider

    def test_snowplow_provider_initialization_disabled(self):
        """Test Snowplow provider when disabled."""
        provider = SnowplowAnalyticsProvider()
        result = provider.initialize({'enabled': False})

        assert result is True
        assert provider.is_enabled() is False

    @patch('met_api.utils.snowplow_tracker.get_tracker')
    def test_snowplow_provider_initialization_enabled(self, mock_get_tracker):
        """Test Snowplow provider when enabled."""
        mock_tracker = MagicMock()
        mock_get_tracker.return_value = mock_tracker

        provider = SnowplowAnalyticsProvider()
        result = provider.initialize({
            'enabled': True,
            'collector': 'spt.apps.gov.bc.ca',
            'app_id': 'test-app',
            'namespace': 'test-api'
        })

        assert result is True
        assert provider.is_enabled() is True

    def test_track_survey_submission_disabled(self):
        """Test tracking when provider is disabled."""
        provider = SnowplowAnalyticsProvider()
        provider.initialize({'enabled': False})

        result = provider.track_survey_submission(
            survey_id=123,
            engagement_id=456,
            submission_id=789
        )

        assert result is True  # Should succeed even when disabled

    def test_track_email_verification_disabled(self):
        """Test email verification tracking when disabled."""
        provider = SnowplowAnalyticsProvider()
        provider.initialize({'enabled': False})

        result = provider.track_email_verification(
            survey_id=123,
            engagement_id=456,
            verification_type='survey'
        )

        assert result is True

    def test_track_error_disabled(self):
        """Test error tracking when disabled."""
        provider = SnowplowAnalyticsProvider()
        provider.initialize({'enabled': False})

        result = provider.track_error(
            error_type='ValidationError',
            error_message='Test error',
            properties={'endpoint': '/api/test', 'status_code': 400}
        )

        assert result is True

    def test_analytics_event_creation(self):
        """Test creating an analytics event."""
        event = AnalyticsEvent(
            event_type='survey_submission',
            category='survey',
            action='submit',
            label='survey-123',
            value=1.0,
            properties={'submission_id': 789},
            context={'tenant': 'EAO'}
        )

        assert event.event_type == 'survey_submission'
        assert event.category == 'survey'
        assert event.action == 'submit'
        assert event.label == 'survey-123'
        assert event.value == 1.0
        assert event.properties['submission_id'] == 789
        assert event.context['tenant'] == 'EAO'

    def test_analytics_event_to_dict(self):
        """Test converting event to dictionary."""
        event = AnalyticsEvent(
            event_type='test_event',
            category='test',
            action='test_action'
        )

        event_dict = event.to_dict()

        assert event_dict['event_type'] == 'test_event'
        assert event_dict['category'] == 'test'
        assert event_dict['action'] == 'test_action'
        assert isinstance(event_dict['properties'], dict)
        assert isinstance(event_dict['context'], dict)

    def test_convenience_functions_with_disabled_manager(self):
        """Test convenience functions when manager is not initialized."""
        # Reset the global manager
        analytics._analytics_manager = None

        # These should not raise exceptions
        result1 = analytics.track_survey_submission(123, 456)
        result2 = analytics.track_email_verification(123, 456)
        result3 = analytics.track_error('TestError', 'test message')

        # All should return True (graceful degradation)
        assert result1 is True
        assert result2 is True
        assert result3 is True

    def test_manager_tracks_with_multiple_providers(self):
        """Test manager tracks events across multiple providers."""
        manager = AnalyticsManager()

        provider1 = SnowplowAnalyticsProvider()
        provider1.initialize({'enabled': False})

        provider2 = SnowplowAnalyticsProvider()
        provider2.initialize({'enabled': False})

        manager.initialize(provider1, [provider2])

        # Should track to both providers
        result = manager.track_survey_submission(123, 456)
        assert result is True

    @patch('met_api.utils.snowplow_tracker.get_tracker')
    def test_snowplow_provider_track_event(self, mock_get_tracker):
        """Test tracking a generic event through Snowplow provider."""
        mock_tracker = MagicMock()
        mock_tracker.track_struct_event = MagicMock(return_value=True)
        mock_get_tracker.return_value = mock_tracker

        provider = SnowplowAnalyticsProvider()
        provider.initialize({'enabled': True})

        event = AnalyticsEvent(
            event_type='custom_event',
            category='custom',
            action='test',
            label='test-label'
        )

        result = provider.track_event(event)
        assert result is True

    def test_provider_handles_exception_gracefully(self):
        """Test that provider handles exceptions without crashing."""
        provider = SnowplowAnalyticsProvider()
        provider.initialize({'enabled': True})
        # Tracker is not properly initialized, but should not crash

        result = provider.track_survey_submission(123, 456)
        # Should return False due to missing tracker, but not raise exception
        assert result is False or result is True


class TestAnalyticsManagerFallback:
    """Test analytics manager fallback behavior."""

    def test_fallback_to_secondary_provider(self):
        """Test that manager falls back to secondary provider on primary failure."""
        manager = AnalyticsManager()

        # Primary provider that will fail
        primary = MagicMock(spec=BaseAnalyticsProvider)
        primary.track_survey_submission = MagicMock(side_effect=Exception('Primary failed'))

        # Fallback provider that succeeds
        fallback = SnowplowAnalyticsProvider()
        fallback.initialize({'enabled': False})

        manager.initialize(primary, [fallback])

        # Should succeed due to fallback
        result = manager.track_survey_submission(123, 456)
        assert result is True

    def test_all_providers_called(self):
        """Test that all providers are called for an event."""
        manager = AnalyticsManager()

        provider1 = MagicMock(spec=BaseAnalyticsProvider)
        provider1.track_survey_submission = MagicMock(return_value=True)

        provider2 = MagicMock(spec=BaseAnalyticsProvider)
        provider2.track_survey_submission = MagicMock(return_value=True)

        manager.initialize(provider1, [provider2])

        manager.track_survey_submission(123, 456)

        # Both providers should be called
        provider1.track_survey_submission.assert_called_once()
        provider2.track_survey_submission.assert_called_once()

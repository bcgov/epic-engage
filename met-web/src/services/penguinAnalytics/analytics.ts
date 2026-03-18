import Analytics from 'analytics';
import tabEventsPlugin from 'analytics-plugin-tab-events';
import { penguinAnalyticsPlugin } from './penguinPlugin';
import { AnalyticsService, AnalyticsEventProps } from './types';
import { AppConfig } from 'config';

/**
 * Singleton analytics instance
 *
 * Initialized with Penguin Analytics plugin that sends
 * events to /analytics proxy route to bypass ad blockers.
 * Tab events plugin tracks when users switch tabs for accurate time measurement.
 */
const analytics = Analytics({
    app: 'epic-engage',
    version: '1.0.0',
    plugins: [
        penguinAnalyticsPlugin({
            apiUrl: AppConfig.penguinUrl || '/analytics',
            sourceApp: 'epic-engage',
        }),
        tabEventsPlugin(),
    ],
});

/**
 * Analytics service for tracking events in met-web
 */
export const analyticsService: AnalyticsService = {
    /**
     * Track page view
     * @param pageName - Page name (optional)
     * @param engagementId - Engagement ID if viewing engagement content (optional)
     */
    page: (pageName?: string, engagementId?: string) => {
        if (!AppConfig.penguinEnabled) return;
        analytics.page({
            name: pageName,
            properties: {
                action: 'page_view',
                engagement_id: engagementId,
            },
        });
    },

    /**
     * Track analytics event
     * @param props - Event properties with required 'action' field
     */
    track: (props: AnalyticsEventProps) => {
        if (!AppConfig.penguinEnabled) return;
        analytics.track(props.action, props);
    },

    /**
     * Identify user
     * @param userId - Unique user identifier (e.g., Keycloak ID)
     */
    identify: (userId: string) => {
        if (!AppConfig.penguinEnabled) return;
        analytics.identify(userId);
    },

    /**
     * Reset user session (call on logout)
     */
    reset: () => {
        if (!AppConfig.penguinEnabled) return;
        analytics.reset();
    },
};

export default analytics;

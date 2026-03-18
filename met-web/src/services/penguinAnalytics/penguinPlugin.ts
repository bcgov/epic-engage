import { PenguinPluginConfig, PenguinEvent } from './types';

/**
 * Network connection interface for Navigator API
 */
interface NetworkInformation {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
}

/**
 * Extended Navigator with connection property
 */
interface NavigatorWithConnection extends Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
}

/**
 * analytics.js payload structures
 */
interface AnalyticsPayload {
    event?: string;
    properties?: Record<string, unknown>;
    userId?: string;
    traits?: Record<string, unknown>;
    name?: string;
}

interface AnalyticsHookParams {
    payload: AnalyticsPayload;
}

/**
 * Penguin Analytics Plugin for analytics.js
 * Sends events to /analytics proxy route to bypass ad blockers
 */
export function penguinAnalyticsPlugin(config: PenguinPluginConfig) {
    let sessionId: string;

    /**
     * Get or create a session ID (persists in sessionStorage)
     */
    function getOrCreateSessionId(): string {
        const key = 'penguin_session_id';
        let existing = sessionStorage.getItem(key);
        if (!existing) {
            existing = crypto.randomUUID();
            sessionStorage.setItem(key, existing);
        }
        return existing;
    }

    /**
     * Collect browser context properties
     */
    function getBrowserContext() {
        const nav = navigator as NavigatorWithConnection;
        const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

        return {
            url: window.location.href,
            referrer: document.referrer,
            screen_width: window.screen.width,
            screen_height: window.screen.height,
            viewport_width: window.innerWidth,
            viewport_height: window.innerHeight,
            pixel_ratio: window.devicePixelRatio,
            color_depth: window.screen.colorDepth,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
            languages: navigator.languages?.join(','),
            platform: navigator.platform,
            user_agent: navigator.userAgent,
            mobile: /Mobile|Android|iPhone/i.test(navigator.userAgent),
            touch_points: navigator.maxTouchPoints,
            connection_type: connection?.effectiveType,
            connection_downlink: connection?.downlink,
            connection_rtt: connection?.rtt,
        };
    }

    /**
     * Get current page location properties
     */
    function getLocationProperties() {
        return {
            path: window.location.pathname,
            url: window.location.href,
            title: document.title,
        };
    }

    /**
     * Send event to Penguin Analytics API
     */
    async function sendEvent(eventType: string, properties: Record<string, unknown> = {}) {
        const event: PenguinEvent = {
            timestamp: new Date().toISOString(),
            eventType,
            sessionId,
            sourceApp: config.sourceApp,
            properties: {
                ...properties,
                ...getBrowserContext(),
            },
        };

        try {
            const response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event),
            });

            if (!response.ok) {
                console.error('[Penguin Analytics] Failed to send event:', response.statusText);
            }
        } catch (error) {
            console.error('[Penguin Analytics] Error sending event:', error);
        }
    }

    return {
        name: 'penguin-analytics',
        config,

        initialize: () => {
            sessionId = getOrCreateSessionId();
        },

        page: ({ payload }: AnalyticsHookParams) => {
            const properties = payload.properties || {};
            sendEvent('page_view', {
                page_name: properties.name,
                ...getLocationProperties(),
                ...properties,
            });
        },

        track: ({ payload }: AnalyticsHookParams) => {
            sendEvent(payload.event || 'Unknown Event', payload.properties || {});
        },

        identify: ({ payload }: AnalyticsHookParams) => {
            sendEvent('user_identify', {
                user_id: payload.userId,
                traits: payload.traits || {},
                session_start: true,
            });
        },

        tabHidden: () => {
            sendEvent('tab_hidden', getLocationProperties());
        },

        tabVisible: () => {
            sendEvent('tab_visible', getLocationProperties());
        },

        loaded: () => true,
    };
}

/**
 * Configuration for Penguin Analytics plugin
 */
export interface PenguinPluginConfig {
    /** API endpoint URL (e.g., '/analytics' for proxy route) */
    apiUrl: string;
    /** Source application identifier (e.g., 'met-web') */
    sourceApp: string;
}

/**
 * Supported analytics actions
 */
export type AnalyticsAction =
    | 'page_view'
    | 'survey_start'
    | 'completed_step'
    | 'survey_submit'
    | 'video_play'
    | 'document_open'
    | 'link_click'
    | 'subscription_click'
    | 'map_click'
    | 'cta_click'
    | 'email_submitted'
    | 'error';

/**
 * Analytics event properties (all fields except 'action' are optional)
 */
export interface AnalyticsEventProps {
    /** The action that was taken (required) */
    action: AnalyticsAction;
    /** Survey name, where applicable */
    survey_name?: string;
    /** Survey ID, where applicable */
    survey_id?: string;
    /** Engagement ID - links survey to parent engagement */
    engagement_id?: string;
    /** Name of the current step, where applicable */
    step_name?: string;
    /** Current step number (1-indexed), where applicable */
    step_number?: number;
    /** Total number of steps in the survey, where applicable */
    step_count?: number;
    /** Participant ID number (privacy review dependent) */
    participant_id?: string;
    /** Contextual text: URL, video title, document name, widget name, or error message */
    text?: string;
    /** Widget type for widget interactions */
    widget_type?: string;
    /** Verification token from email link - links email submission to survey landing */
    verification_token?: string;
}

/**
 * Penguin Analytics event payload (internal structure)
 */
export interface PenguinEvent {
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Event type/name */
    eventType: string;
    /** Session identifier */
    sessionId: string;
    /** User identifier (if authenticated) */
    userId?: string;
    /** Source application */
    sourceApp: string;
    /** Event-specific properties */
    properties: Record<string, unknown>;
}

/**
 * Analytics service interface
 */
export interface AnalyticsService {
    /** Track page view */
    page: (pageName?: string, engagementId?: string) => void;
    /** Track custom event */
    track: (props: AnalyticsEventProps) => void;
    /** Identify user */
    identify: (userId: string) => void;
    /** Reset user session */
    reset: () => void;
}

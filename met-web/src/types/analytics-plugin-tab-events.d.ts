/**
 * Type definitions for analytics-plugin-tab-events
 * This plugin tracks tab visibility events (hidden/visible) for analytics.js
 */
declare module 'analytics-plugin-tab-events' {
    function tabEventsPlugin(): {
        name: string;
        initialize: () => void;
    };
    export default tabEventsPlugin;
}

/**
 * Unit tests for Penguin Analytics service
 */
import '@testing-library/jest-dom';

// Create mock functions that will be shared across imports
const mockPage = jest.fn();
const mockTrack = jest.fn();
const mockIdentify = jest.fn();
const mockReset = jest.fn();

// Mock the analytics library to return our shared mock functions
jest.mock('analytics', () => {
    return jest.fn(() => ({
        page: mockPage,
        track: mockTrack,
        identify: mockIdentify,
        reset: mockReset,
    }));
});

// Mock the config module
jest.mock('config', () => ({
    AppConfig: {
        penguinUrl: '/analytics',
        penguinEnabled: true,
    },
}));

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
    value: {
        randomUUID: jest.fn(() => 'test-uuid-1234'),
    },
});

// Mock sessionStorage
const sessionStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();

Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
});

describe('Penguin Analytics Service', () => {
    let analyticsService: any;
    let AppConfig: any;

    beforeEach(() => {
        // Clear all mocks before each test
        mockPage.mockClear();
        mockTrack.mockClear();
        mockIdentify.mockClear();
        mockReset.mockClear();
        sessionStorageMock.clear();

        // Re-import to get fresh config
        jest.resetModules();
        jest.doMock('config', () => ({
            AppConfig: {
                penguinUrl: '/analytics',
                penguinEnabled: true,
            },
        }));

        // Import the service
        AppConfig = require('config').AppConfig;
        analyticsService = require('services/penguinAnalytics').analyticsService;
    });

    describe('Feature Flag', () => {
        it('should not track when penguinEnabled is false', () => {
            // Disable tracking
            AppConfig.penguinEnabled = false;

            // Re-import to pick up new config
            jest.resetModules();
            jest.doMock('config', () => ({
                AppConfig: {
                    penguinUrl: '/analytics',
                    penguinEnabled: false,
                },
            }));

            const { analyticsService: disabledService } = require('services/penguinAnalytics');

            disabledService.page('Test Page');
            disabledService.track({ action: 'survey_start' });
            disabledService.identify('user-123');
            disabledService.reset();

            // Analytics should not be called
            expect(mockPage).not.toHaveBeenCalled();
            expect(mockTrack).not.toHaveBeenCalled();
            expect(mockIdentify).not.toHaveBeenCalled();
            expect(mockReset).not.toHaveBeenCalled();
        });

        it('should track when penguinEnabled is true', () => {
            analyticsService.page('Test Page');

            expect(mockPage).toHaveBeenCalledWith({
                name: 'Test Page',
                properties: {
                    action: 'page_view',
                    engagement_id: undefined,
                },
            });
        });
    });

    describe('page()', () => {
        it('should track page view with name only', () => {
            analyticsService.page('Engagement Results');

            expect(mockPage).toHaveBeenCalledWith({
                name: 'Engagement Results',
                properties: {
                    action: 'page_view',
                    engagement_id: undefined,
                },
            });
            expect(mockPage).toHaveBeenCalledTimes(1);
        });

        it('should track page view with name and engagement_id', () => {
            analyticsService.page('Survey Landing', 'eng-456');

            expect(mockPage).toHaveBeenCalledWith({
                name: 'Survey Landing',
                properties: {
                    action: 'page_view',
                    engagement_id: 'eng-456',
                },
            });
        });

        it('should track page view without parameters', () => {
            analyticsService.page();

            expect(mockPage).toHaveBeenCalledWith({
                name: undefined,
                properties: {
                    action: 'page_view',
                    engagement_id: undefined,
                },
            });
        });
    });

    describe('track()', () => {
        it('should track survey_start event', () => {
            const event = {
                action: 'survey_start' as const,
                survey_id: '82124',
                survey_name: 'Fraser Tunnel',
                engagement_id: 'eng-456',
            };

            analyticsService.track(event);

            expect(mockTrack).toHaveBeenCalledWith('survey_start', event);
            expect(mockTrack).toHaveBeenCalledTimes(1);
        });

        it('should track completed_step event', () => {
            const event = {
                action: 'completed_step' as const,
                survey_id: '82124',
                step_name: 'Intro',
                step_number: 1,
                step_count: 12,
            };

            analyticsService.track(event);

            expect(mockTrack).toHaveBeenCalledWith('completed_step', event);
        });

        it('should track survey_submit event', () => {
            const event = {
                action: 'survey_submit' as const,
                survey_id: '82124',
                participant_id: '7222',
            };

            analyticsService.track(event);

            expect(mockTrack).toHaveBeenCalledWith('survey_submit', event);
        });

        it('should track video_play widget event', () => {
            const event = {
                action: 'video_play' as const,
                engagement_id: 'eng-456',
                widget_type: 'video',
                text: 'Project Overview Video',
            };

            analyticsService.track(event);

            expect(mockTrack).toHaveBeenCalledWith('video_play', event);
        });

        it('should track document_open event', () => {
            const event = {
                action: 'document_open' as const,
                engagement_id: 'eng-456',
                widget_type: 'document',
                text: 'Project_Plan.pdf',
            };

            analyticsService.track(event);

            expect(mockTrack).toHaveBeenCalledWith('document_open', event);
        });

        it('should track cta_click event', () => {
            const event = {
                action: 'cta_click' as const,
                engagement_id: 'eng-456',
                text: 'Share your Thoughts',
            };

            analyticsService.track(event);

            expect(mockTrack).toHaveBeenCalledWith('cta_click', event);
        });

        it('should track link_click event', () => {
            const event = {
                action: 'link_click' as const,
                survey_id: '82124',
                text: 'https://example.com/more-info',
            };

            analyticsService.track(event);

            expect(mockTrack).toHaveBeenCalledWith('link_click', event);
        });

        it('should track error event', () => {
            const event = {
                action: 'error' as const,
                survey_id: '82124',
                step_name: 'Email Input',
                text: 'Invalid email format',
            };

            analyticsService.track(event);

            expect(mockTrack).toHaveBeenCalledWith('error', event);
        });

        it('should track subscription_click event', () => {
            const event = {
                action: 'subscription_click' as const,
                engagement_id: 'eng-456',
                widget_type: 'sign_up',
            };

            analyticsService.track(event);

            expect(mockTrack).toHaveBeenCalledWith('subscription_click', event);
        });

        it('should track map_click event', () => {
            const event = {
                action: 'map_click' as const,
                engagement_id: 'eng-456',
                widget_type: 'map',
            };

            analyticsService.track(event);

            expect(mockTrack).toHaveBeenCalledWith('map_click', event);
        });
    });

    describe('identify()', () => {
        it('should identify user with userId', () => {
            const userId = 'keycloak-user-123';

            analyticsService.identify(userId);

            expect(mockIdentify).toHaveBeenCalledWith(userId);
            expect(mockIdentify).toHaveBeenCalledTimes(1);
        });

        it('should handle UUID format userId', () => {
            const userId = '550e8400-e29b-41d4-a716-446655440000';

            analyticsService.identify(userId);

            expect(mockIdentify).toHaveBeenCalledWith(userId);
        });
    });

    describe('reset()', () => {
        it('should reset analytics session', () => {
            analyticsService.reset();

            expect(mockReset).toHaveBeenCalledTimes(1);
        });

        it('should be callable multiple times', () => {
            analyticsService.reset();
            analyticsService.reset();

            expect(mockReset).toHaveBeenCalledTimes(2);
        });
    });

    describe('Session Management', () => {
        it('should create session ID on first call', () => {
            // Import plugin to trigger session creation
            const { penguinAnalyticsPlugin } = require('services/penguinAnalytics');

            const plugin = penguinAnalyticsPlugin({
                apiUrl: '/analytics',
                sourceApp: 'met-web',
            });

            // Initialize plugin (simulating analytics.js lifecycle)
            plugin.initialize?.({});

            // Check that session was stored
            expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
                'penguin_session_id',
                'test-uuid-1234'
            );
        });
    });

    describe('Integration', () => {
        it('should handle complete survey flow', () => {
            // User views engagement page
            analyticsService.page('Engagement Page', 'eng-456');

            // User clicks CTA
            analyticsService.track({
                action: 'cta_click',
                engagement_id: 'eng-456',
                text: 'Share your Thoughts',
            });

            // User starts survey
            analyticsService.track({
                action: 'survey_start',
                survey_id: '82124',
                survey_name: 'Fraser Tunnel',
                engagement_id: 'eng-456',
            });

            // User completes steps
            analyticsService.track({
                action: 'completed_step',
                survey_id: '82124',
                step_name: 'Intro',
                step_number: 1,
                step_count: 12,
            });

            analyticsService.track({
                action: 'completed_step',
                survey_id: '82124',
                step_name: 'Questions',
                step_number: 2,
                step_count: 12,
            });

            // User submits survey
            analyticsService.track({
                action: 'survey_submit',
                survey_id: '82124',
                participant_id: '7222',
            });

            // Verify all events tracked
            expect(mockPage).toHaveBeenCalledTimes(1);
            expect(mockTrack).toHaveBeenCalledTimes(5);
        });
    });

    describe('Landing Page Visit Rate Metric', () => {
        it('should track email_submitted event with verification_token', () => {
            const event = {
                action: 'email_submitted' as const,
                engagement_id: 'eng-456',
                survey_id: '82124',
                verification_token: 'abc123-token',
            };

            analyticsService.track(event);

            expect(mockTrack).toHaveBeenCalledWith('email_submitted', event);
        });

        it('should track survey_start event with verification_token', () => {
            const event = {
                action: 'survey_start' as const,
                engagement_id: 'eng-456',
                survey_id: '82124',
                verification_token: 'abc123-token',
            };

            analyticsService.track(event);

            expect(mockTrack).toHaveBeenCalledWith('survey_start', event);
        });

        it('should track complete email-to-survey journey with same token', () => {
            const verificationToken = 'journey-token-xyz';

            // Step 1: User submits email in modal
            analyticsService.track({
                action: 'email_submitted',
                engagement_id: 'eng-456',
                survey_id: '82124',
                verification_token: verificationToken,
            });

            // Step 2: User clicks email link and lands on survey
            analyticsService.track({
                action: 'survey_start',
                engagement_id: 'eng-456',
                survey_id: '82124',
                verification_token: verificationToken,
            });

            expect(mockTrack).toHaveBeenCalledTimes(2);

            // Both events have same token for correlation
            const calls = mockTrack.mock.calls;
            expect(calls[0][1].verification_token).toBe(verificationToken);
            expect(calls[1][1].verification_token).toBe(verificationToken);
        });
    });
});

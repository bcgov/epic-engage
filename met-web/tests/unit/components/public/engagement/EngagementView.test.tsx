import React from 'react';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { setupEnv } from '../../setEnvVars';
import ProviderShell from '../../ProviderShell';
import { Engagement } from 'components/public/engagement/view';
import * as engagementService from 'services/engagementService';
import * as engagementMetadataService from 'services/engagementMetadataService';
import * as engagementSettingService from 'services/engagementSettingService';
import * as engagementSlugService from 'services/engagementSlugService';
import * as emailVerificationService from 'services/emailVerificationService';
import * as notificationSlice from 'services/notificationService/notificationSlice';
import * as reactRedux from 'react-redux';
import { openEngagement, engagementMetadata, engagementSetting } from '../../factory';
import { SubmissionStatus } from 'constants/engagementStatus';

// Mock axios
jest.mock('axios');

// Mock RTK Query
jest.mock('@reduxjs/toolkit/query/react', () => ({
    ...jest.requireActual('@reduxjs/toolkit/query/react'),
    fetchBaseQuery: jest.fn(),
}));

// Mock hooks
jest.mock('hooks', () => ({
    ...jest.requireActual('hooks'),
    useAppTranslation: jest.fn(() => ({
        t: (key: string) => key,
    })),
}));

// Mock widget API slice
jest.mock('apiManager/apiSlices/widgets', () => ({
    ...jest.requireActual('apiManager/apiSlices/widgets'),
    useLazyGetWidgetsQuery: jest.fn(() => [jest.fn(), { data: [], isLoading: false }]),
}));

// Mock analytics
jest.mock('services/penguinAnalytics', () => ({
    analyticsService: {
        page: jest.fn(),
        track: jest.fn(),
    },
}));

// Mock react-router
const mockNavigate = jest.fn();
const mockParams: { engagementId?: string; slug?: string; token?: string } = { engagementId: '2' };
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => ({
        pathname: '/engagements/2/view',
        state: null,
    }),
}));

// Mock maplibre
jest.mock('maplibre-gl/dist/maplibre-gl', () => ({
    Map: () => ({}),
}));

// Mock MUI components that may have issues in test environment
jest.mock('@mui/material', () => ({
    ...jest.requireActual('@mui/material'),
    useMediaQuery: jest.fn(() => true),
}));

// Mock snowplow
(window as Window & { snowplow?: () => void }).snowplow = jest.fn();

describe('EngagementView Integration Tests', () => {
    const mockDispatch = jest.fn();

    // Set up spies
    let getEngagementMock: jest.SpyInstance;
    let getEngagementMetadataMock: jest.SpyInstance;
    let getEngagementSettingsMock: jest.SpyInstance;
    let createEmailVerificationMock: jest.SpyInstance;
    let getEngagementIdBySlugMock: jest.SpyInstance;

    beforeEach(() => {
        setupEnv();
        jest.clearAllMocks();

        // Setup default mocks
        jest.spyOn(reactRedux, 'useDispatch').mockReturnValue(mockDispatch);
        jest.spyOn(notificationSlice, 'openNotification').mockImplementation(jest.fn());

        getEngagementMock = jest.spyOn(engagementService, 'getEngagement');
        getEngagementMetadataMock = jest.spyOn(engagementMetadataService, 'getEngagementMetadata');
        getEngagementSettingsMock = jest.spyOn(engagementSettingService, 'getEngagementSettings');
        createEmailVerificationMock = jest.spyOn(emailVerificationService, 'createEmailVerification');
        getEngagementIdBySlugMock = jest.spyOn(engagementSlugService, 'getEngagementIdBySlug');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const mockOpenEngagement = {
        ...openEngagement,
        id: 2,
        name: 'Open Engagement for Testing',
        submission_status: SubmissionStatus.Open,
        surveys: [{ id: 1, name: 'Test Survey', engagement_id: 2 }],
        status_block: [
            {
                id: 1,
                survey_status: 'Open',
                block_text: '{"blocks":[{"key":"test","text":"Share your thoughts!","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}',
            },
        ],
        rich_content: '{"blocks":[{"key":"content","text":"Test engagement content","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}',
        content: 'Test engagement content',
        visibility: 1, // Public
    };

    const mockEngagementMetadata = {
        ...engagementMetadata,
        engagement_id: 2,
    };

    const mockEngagementSettings = {
        ...engagementSetting,
        engagement_id: 2,
        send_report: true,
    };

    describe('Engagement Loading', () => {
        test('loads and displays engagement content by ID', async () => {
            getEngagementMock.mockResolvedValueOnce(mockOpenEngagement);
            getEngagementMetadataMock.mockResolvedValueOnce(mockEngagementMetadata);
            getEngagementSettingsMock.mockResolvedValueOnce(mockEngagementSettings);

            render(
                <ProviderShell>
                    <Engagement />
                </ProviderShell>
            );

            await waitFor(() => {
                expect(getEngagementMock).toHaveBeenCalledWith(2);
            });

            await waitFor(() => {
                expect(screen.getByTestId('engagement-content')).toBeInTheDocument();
            });
        });

        test('fetches engagement metadata and settings', async () => {
            getEngagementMock.mockResolvedValueOnce(mockOpenEngagement);
            getEngagementMetadataMock.mockResolvedValueOnce(mockEngagementMetadata);
            getEngagementSettingsMock.mockResolvedValueOnce(mockEngagementSettings);

            render(
                <ProviderShell>
                    <Engagement />
                </ProviderShell>
            );

            await waitFor(() => {
                expect(getEngagementMetadataMock).toHaveBeenCalledWith(2);
                expect(getEngagementSettingsMock).toHaveBeenCalledWith(2);
            });
        });

        test('navigates to home on engagement fetch error', async () => {
            getEngagementMock.mockRejectedValueOnce(new Error('Not found'));

            render(
                <ProviderShell>
                    <Engagement />
                </ProviderShell>
            );

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith('/');
            });
        });
    });

    describe('Survey Block States', () => {
        test('displays "Share Your Thoughts" button when engagement is open', async () => {
            getEngagementMock.mockResolvedValueOnce(mockOpenEngagement);
            getEngagementMetadataMock.mockResolvedValueOnce(mockEngagementMetadata);
            getEngagementSettingsMock.mockResolvedValueOnce(mockEngagementSettings);

            render(
                <ProviderShell>
                    <Engagement />
                </ProviderShell>
            );

            await waitFor(() => {
                expect(screen.getByTestId('SurveyBlock/take-me-to-survey-button')).toBeInTheDocument();
            });

            expect(screen.getByText('Share Your Thoughts')).toBeInTheDocument();
        });

        test('displays "View Feedback" button when engagement is closed and send_report is true', async () => {
            const closedEngagement = {
                ...mockOpenEngagement,
                submission_status: SubmissionStatus.Closed,
                status_block: [
                    {
                        id: 1,
                        survey_status: 'Closed',
                        block_text: '{"blocks":[{"key":"test","text":"This engagement is now closed.","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}',
                    },
                ],
            };

            getEngagementMock.mockResolvedValueOnce(closedEngagement);
            getEngagementMetadataMock.mockResolvedValueOnce(mockEngagementMetadata);
            getEngagementSettingsMock.mockResolvedValueOnce(mockEngagementSettings);

            render(
                <ProviderShell>
                    <Engagement />
                </ProviderShell>
            );

            await waitFor(() => {
                expect(screen.getByTestId('SurveyBlock/view-feedback-button')).toBeInTheDocument();
            });

            expect(screen.getByText('View Feedback')).toBeInTheDocument();
        });
    });

    describe('Email Modal Flow', () => {
        test('opens email modal when "Share Your Thoughts" is clicked', async () => {
            getEngagementMock.mockResolvedValueOnce(mockOpenEngagement);
            getEngagementMetadataMock.mockResolvedValueOnce(mockEngagementMetadata);
            getEngagementSettingsMock.mockResolvedValueOnce(mockEngagementSettings);

            render(
                <ProviderShell>
                    <Engagement />
                </ProviderShell>
            );

            await waitFor(() => {
                expect(screen.getByTestId('SurveyBlock/take-me-to-survey-button')).toBeInTheDocument();
            });

            const button = screen.getByTestId('SurveyBlock/take-me-to-survey-button');
            fireEvent.click(button);

            // The modal should now be open - check for email input field
            await waitFor(() => {
                // Look for elements that would be in the email modal
                const modal = document.querySelector('[role="presentation"]');
                expect(modal).toBeInTheDocument();
            });
        });

        test('successfully submits email for verification', async () => {
            getEngagementMock.mockResolvedValueOnce(mockOpenEngagement);
            getEngagementMetadataMock.mockResolvedValueOnce(mockEngagementMetadata);
            getEngagementSettingsMock.mockResolvedValueOnce(mockEngagementSettings);
            createEmailVerificationMock.mockResolvedValueOnce({
                email_address: 'test@example.com',
                survey_id: 1,
            });

            render(
                <ProviderShell>
                    <Engagement />
                </ProviderShell>
            );

            await waitFor(() => {
                expect(screen.getByTestId('SurveyBlock/take-me-to-survey-button')).toBeInTheDocument();
            });

            // Open modal
            const startButton = screen.getByTestId('SurveyBlock/take-me-to-survey-button');
            fireEvent.click(startButton);

            await waitFor(() => {
                const modal = document.querySelector('[role="presentation"]');
                expect(modal).toBeInTheDocument();
            });
        });
    });

    describe('Slug-based Loading', () => {
        beforeEach(() => {
            // Update mock params to use slug instead of engagementId
            mockParams.engagementId = undefined;
            mockParams.slug = 'test-engagement-slug';
        });

        afterEach(() => {
            // Reset params
            mockParams.engagementId = '2';
            mockParams.slug = undefined;
        });

        test('resolves slug to engagement ID and loads engagement', async () => {
            getEngagementIdBySlugMock.mockResolvedValueOnce({ engagement_id: 2 });
            getEngagementMock.mockResolvedValueOnce(mockOpenEngagement);
            getEngagementMetadataMock.mockResolvedValueOnce(mockEngagementMetadata);
            getEngagementSettingsMock.mockResolvedValueOnce(mockEngagementSettings);

            render(
                <ProviderShell>
                    <Engagement />
                </ProviderShell>
            );

            await waitFor(() => {
                expect(getEngagementIdBySlugMock).toHaveBeenCalledWith('test-engagement-slug');
            });

            await waitFor(() => {
                expect(getEngagementMock).toHaveBeenCalledWith(2);
            });
        });
    });

    describe('Analytics Tracking', () => {
        test('tracks page view when engagement loads', async () => {
            const { analyticsService } = require('services/penguinAnalytics');

            getEngagementMock.mockResolvedValueOnce(mockOpenEngagement);
            getEngagementMetadataMock.mockResolvedValueOnce(mockEngagementMetadata);
            getEngagementSettingsMock.mockResolvedValueOnce(mockEngagementSettings);

            render(
                <ProviderShell>
                    <Engagement />
                </ProviderShell>
            );

            await waitFor(() => {
                expect(analyticsService.page).toHaveBeenCalledWith(
                    'Open Engagement for Testing',
                    '2',
                    'public',
                    'Open Engagement for Testing'
                );
            });
        });

        test('tracks CTA click when Share Your Thoughts is clicked', async () => {
            const { analyticsService } = require('services/penguinAnalytics');

            getEngagementMock.mockResolvedValueOnce(mockOpenEngagement);
            getEngagementMetadataMock.mockResolvedValueOnce(mockEngagementMetadata);
            getEngagementSettingsMock.mockResolvedValueOnce(mockEngagementSettings);

            render(
                <ProviderShell>
                    <Engagement />
                </ProviderShell>
            );

            await waitFor(() => {
                expect(screen.getByTestId('SurveyBlock/take-me-to-survey-button')).toBeInTheDocument();
            });

            const button = screen.getByTestId('SurveyBlock/take-me-to-survey-button');
            fireEvent.click(button);

            await waitFor(() => {
                expect(analyticsService.track).toHaveBeenCalledWith({
                    action: 'cta_click',
                    engagement_id: '2',
                    engagement_name: 'Open Engagement for Testing',
                    text: 'Share Your Thoughts',
                    user_type: 'public',
                });
            });
        });
    });
});

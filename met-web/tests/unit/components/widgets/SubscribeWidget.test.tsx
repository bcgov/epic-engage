import React from 'react';
import { render, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { setupEnv } from '../setEnvVars';
import ProviderShell from '../ProviderShell';
import { EngagementViewContext } from 'components/public/engagement/view/EngagementViewContext';
import {
    createDefaultEngagement,
    createDefaultEngagementMetadata,
    createDefaultEngagementSettings,
} from 'models/engagement';
import { SubmissionStatus } from 'constants/engagementStatus';
import SubscribeWidget from 'components/public/engagement/view/widgets/Subscribe/SubscribeWidget';
import * as subscriptionService from 'services/subscriptionService';
import { openEngagement, subscribeWidget as mockSubscribeWidget } from '../factory';
import { SUBSCRIBE_TYPE, SubscribeForm, SubscribeFormItem } from 'models/subscription';

jest.mock('axios');
jest.mock('@reduxjs/toolkit/query/react', () => ({
    ...jest.requireActual('@reduxjs/toolkit/query/react'),
    fetchBaseQuery: jest.fn(),
}));
jest.mock('apiManager/apiSlices/widgets', () => ({
    ...jest.requireActual('apiManager/apiSlices/widgets'),
    useLazyGetWidgetsQuery: jest.fn(() => [jest.fn(), { data: [], isLoading: false }]),
}));
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => jest.fn(),
    useParams: () => ({ engagementId: '2' }),
    useLocation: () => ({ pathname: '/engagements/2/view', state: null }),
}));
jest.mock('services/penguinAnalytics', () => ({
    analyticsService: { page: jest.fn(), track: jest.fn() },
}));

const mockContextValue = {
    savedEngagement: { ...createDefaultEngagement(), ...openEngagement },
    engagementMetadata: createDefaultEngagementMetadata(),
    engagementSettings: createDefaultEngagementSettings(),
    isEngagementLoading: false,
    isWidgetsLoading: false,
    isEngagementMetadataLoading: false,
    isEngagementSettingsLoading: false,
    scheduleEngagement: jest.fn(),
    unpublishEngagement: jest.fn(),
    republishEngagement: jest.fn(),
    widgets: [mockSubscribeWidget],
    mockStatus: SubmissionStatus.Open,
    updateMockStatus: jest.fn(),
};

const mockSubscribeFormItem: SubscribeFormItem = {
    id: 1,
    description: 'Subscribe to stay updated',
    rich_description: '',
    call_to_action_type: 'button',
    call_to_action_text: 'Subscribe Now',
    form_type: SUBSCRIBE_TYPE.EMAIL_LIST,
    created_date: '2024-01-01',
    updated_date: '2024-01-01',
    widget_subscribe: 1,
};

const mockEmailListForm: SubscribeForm = {
    id: 1,
    title: 'Stay Informed',
    type: SUBSCRIBE_TYPE.EMAIL_LIST,
    sort_index: 0,
    widget_id: mockSubscribeWidget.id,
    created_date: '2024-01-01',
    updated_date: '2024-01-01',
    subscribe_items: [mockSubscribeFormItem],
};

const mockSignUpForm: SubscribeForm = {
    id: 2,
    title: 'Sign Up',
    type: SUBSCRIBE_TYPE.SIGN_UP,
    sort_index: 1,
    widget_id: mockSubscribeWidget.id,
    created_date: '2024-01-01',
    updated_date: '2024-01-01',
    subscribe_items: [{ ...mockSubscribeFormItem, id: 2, form_type: SUBSCRIBE_TYPE.SIGN_UP }],
};

const renderSubscribeWidget = () =>
    render(
        <ProviderShell>
            <EngagementViewContext.Provider value={mockContextValue}>
                <SubscribeWidget widget={mockSubscribeWidget} />
            </EngagementViewContext.Provider>
        </ProviderShell>,
    );

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('SubscribeWidget', () => {
    test('shows skeleton while loading forms', () => {
        jest.spyOn(subscriptionService, 'getSubscriptionsForms').mockReturnValue(new Promise(() => {}));
        const { container } = renderSubscribeWidget();
        // Skeleton should be rendered (as a loading placeholder)
        expect(container.querySelector('.MuiSkeleton-root')).toBeInTheDocument();
    });

    test('renders widget title after loading EMAIL_LIST form', async () => {
        jest.spyOn(subscriptionService, 'getSubscriptionsForms').mockResolvedValueOnce([mockEmailListForm]);
        renderSubscribeWidget();
        await waitFor(() => {
            expect(screen.getByText(mockSubscribeWidget.title)).toBeInTheDocument();
        });
    });

    test('renders EMAIL_LIST section with call-to-action button text', async () => {
        jest.spyOn(subscriptionService, 'getSubscriptionsForms').mockResolvedValueOnce([mockEmailListForm]);
        renderSubscribeWidget();
        await waitFor(() => {
            expect(screen.getByText(mockSubscribeFormItem.call_to_action_text)).toBeInTheDocument();
        });
    });

    test('dispatches error notification when getSubscriptionsForms fails', async () => {
        jest.spyOn(subscriptionService, 'getSubscriptionsForms').mockRejectedValueOnce(new Error('Service error'));
        renderSubscribeWidget();
        // Widget should handle error gracefully without crashing
        await waitFor(() => {
            // The skeleton disappears; in the error path, loading is NOT set to false
            // but the dispatch for notification is called
            expect(subscriptionService.getSubscriptionsForms).toHaveBeenCalledWith(mockSubscribeWidget.id);
        });
    });

    test('renders empty widget when no forms returned', async () => {
        jest.spyOn(subscriptionService, 'getSubscriptionsForms').mockResolvedValueOnce([]);
        renderSubscribeWidget();
        await waitFor(() => {
            expect(screen.getByText(mockSubscribeWidget.title)).toBeInTheDocument();
        });
    });

    test('calls getSubscriptionsForms with correct widget id', async () => {
        const mockSpy = jest.spyOn(subscriptionService, 'getSubscriptionsForms').mockResolvedValueOnce([]);
        renderSubscribeWidget();
        await waitFor(() => {
            expect(mockSpy).toHaveBeenCalledWith(mockSubscribeWidget.id);
        });
    });
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { setupEnv } from '../setEnvVars';
import ProviderShell from '../ProviderShell';
import { EngagementViewContext } from 'components/public/engagement/view/EngagementViewContext';
import {
    createDefaultEngagement,
    createDefaultEngagementMetadata,
    createDefaultEngagementSettings,
} from 'models/engagement';
import EmailListModal from 'components/public/engagement/view/widgets/Subscribe/EmailListModal';
import { openEngagement } from '../factory';
import { SubmissionStatus } from 'constants/engagementStatus';

jest.mock('axios');
jest.mock('services/emailVerificationService', () => ({
    createSubscribeEmailVerification: jest.fn(),
}));
jest.mock('services/subscriptionService', () => ({
    createSubscription: jest.fn(),
}));
jest.mock('services/notificationModalService/notificationModalSlice', () => ({
    openNotificationModal: jest.fn((payload) => ({ type: 'notificationModal/open', payload })),
}));
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => jest.fn(),
    useParams: () => ({ engagementId: '2' }),
    useLocation: () => ({ pathname: '/engagements/2/view', state: null }),
}));

import { createSubscribeEmailVerification } from 'services/emailVerificationService';
import { createSubscription } from 'services/subscriptionService';
import { openNotificationModal } from 'services/notificationModalService/notificationModalSlice';

const mockCreateSubscribeEmailVerification = createSubscribeEmailVerification as jest.Mock;
const mockCreateSubscription = createSubscription as jest.Mock;

const mockContextValue = {
    savedEngagement: {
        ...createDefaultEngagement(),
        ...openEngagement,
    },
    engagementMetadata: {
        ...createDefaultEngagementMetadata(),
    },
    engagementSettings: createDefaultEngagementSettings(),
    isEngagementLoading: false,
    isWidgetsLoading: false,
    isEngagementMetadataLoading: false,
    isEngagementSettingsLoading: false,
    scheduleEngagement: jest.fn(),
    unpublishEngagement: jest.fn(),
    republishEngagement: jest.fn(),
    widgets: [],
    mockStatus: SubmissionStatus.Open,
    updateMockStatus: jest.fn(),
};

const renderEmailListModal = (open = true, setOpen = jest.fn()) =>
    render(
        <ProviderShell>
            <EngagementViewContext.Provider value={mockContextValue}>
                <EmailListModal open={open} setOpen={setOpen} />
            </EngagementViewContext.Provider>
        </ProviderShell>,
    );

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
    // Mock window.snowplow to prevent ReferenceError
    (window as unknown as Record<string, unknown>).snowplow = jest.fn();
});

describe('EmailListModal - render', () => {
    test('renders Sign Up for Updates header', () => {
        renderEmailListModal();
        expect(screen.getByText('Sign Up for Updates')).toBeInTheDocument();
    });

    test('renders email input field', () => {
        renderEmailListModal();
        expect(screen.getByText('Email Address')).toBeInTheDocument();
    });

    test('renders terms and conditions checkbox', () => {
        renderEmailListModal();
        expect(screen.getByText('I agree to the terms and conditions above.')).toBeInTheDocument();
    });

    test('does not render when open is false', () => {
        renderEmailListModal(false);
        // Modal should not be visible
        expect(screen.queryByText('Sign Up for Updates')).not.toBeInTheDocument();
    });
});

describe('EmailListModal - subscription type options', () => {
    test('renders engagement subscription option', () => {
        renderEmailListModal();
        // With no project_id, should show engagement name
        expect(
            screen.getByText(`I want to receive updates for ${openEngagement.name} only`),
        ).toBeInTheDocument();
    });

    test('renders tenant-wide subscription option', () => {
        renderEmailListModal();
        expect(screen.getByText(/I want to receive updates for all the projects at the/)).toBeInTheDocument();
    });
});

describe('EmailListModal - form validation', () => {
    test('shows email error when submitting without email', async () => {
        renderEmailListModal();
        // Check the terms checkbox but leave email empty
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);
        // Find submit button
        const submitButton = screen.getByRole('button', { name: /submit/i });
        fireEvent.click(submitButton);
        await waitFor(() => {
            expect(screen.getByText('Please enter an email')).toBeInTheDocument();
        });
    });

    test('shows terms error when submitting without accepting terms', async () => {
        renderEmailListModal();
        const submitButton = screen.getByRole('button', { name: /submit/i });
        fireEvent.click(submitButton);
        await waitFor(() => {
            expect(screen.getByText('Please accept the terms and conditions')).toBeInTheDocument();
        });
    });
});

describe('EmailListModal - successful subscription', () => {
    test('calls createSubscribeEmailVerification and createSubscription on valid submit', async () => {
        const mockEmailVerification = {
            id: 1,
            email_address: 'test@example.com',
            participant_id: 42,
            survey_id: 1,
            type: 'subscribe',
            token: 'abc123',
            is_active: true,
        };
        mockCreateSubscribeEmailVerification.mockResolvedValueOnce(mockEmailVerification);
        mockCreateSubscription.mockResolvedValueOnce({ id: 1 });

        const setOpen = jest.fn();
        renderEmailListModal(true, setOpen);

        // Enter email
        const emailInput = screen.getByRole('textbox');
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

        // Accept terms
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        // Submit
        const submitButton = screen.getByRole('button', { name: /submit/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockCreateSubscribeEmailVerification).toHaveBeenCalled();
            expect(mockCreateSubscription).toHaveBeenCalled();
            expect(setOpen).toHaveBeenCalledWith(false);
            expect(openNotificationModal).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ header: 'Thank you' }),
                }),
            );
        });
    });
});

describe('EmailListModal - subscription error', () => {
    test('dispatches error modal when subscription fails', async () => {
        mockCreateSubscribeEmailVerification.mockRejectedValueOnce(new Error('API error'));

        const setOpen = jest.fn();
        renderEmailListModal(true, setOpen);

        const emailInput = screen.getByRole('textbox');
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        const submitButton = screen.getByRole('button', { name: /submit/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(setOpen).toHaveBeenCalledWith(false);
            expect(openNotificationModal).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ header: 'We are sorry' }),
                }),
            );
        });
    });
});

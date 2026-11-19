import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProviderShell from '../../ProviderShell';
import { setupEnv } from '../../setEnvVars';
import Subscription from 'components/public/engagement/view/widgets/Subscribe/ManageSubscription/Subscription';
import { SubscriptionType } from 'constants/subscriptionType';

jest.mock('axios');
jest.mock('assets/images/LandingPageBanner.png', () => 'banner.png');
jest.mock('services/subscriptionService', () => ({
    unSubscribeByToken: jest.fn(),
}));
jest.mock('services/notificationService/notificationSlice', () => ({
    openNotification: jest.fn((payload) => ({ type: 'notification/open', payload })),
}));
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useParams: () => ({ token: 'token-1' }),
}));

import { unSubscribeByToken } from 'services/subscriptionService';
import { openNotification } from 'services/notificationService/notificationSlice';

const mockUnSubscribeByToken = unSubscribeByToken as jest.Mock;

const renderPage = () =>
    render(
        <ProviderShell>
            <Subscription />
        </ProviderShell>,
    );

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

test.each([
    [SubscriptionType.TENANT, 'You will no longer receive updates about new engagements.'],
    [SubscriptionType.PROJECT, 'You will no longer receive communications for this project.'],
])('unsubscribing a %s subscription names what stops', async (subscription_type, text) => {
    mockUnSubscribeByToken.mockResolvedValue({ is_subscribed: false, engagement_id: 1, subscription_type });

    renderPage();

    expect(await screen.findByText(text, { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId('CheckCircleRoundedIcon')).toBeInTheDocument();
});

test('a failed unsubscribe shows no success check', async () => {
    mockUnSubscribeByToken.mockRejectedValue(new Error('Subscription Not Found'));

    renderPage();

    await waitFor(() => expect(openNotification).toHaveBeenCalled());
    expect(screen.queryByTestId('CheckCircleRoundedIcon')).not.toBeInTheDocument();
});

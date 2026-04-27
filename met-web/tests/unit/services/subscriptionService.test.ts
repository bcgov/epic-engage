import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import {
    getSubscription,
    createSubscription,
    confirmSubscription,
    unSubscribe,
    getSubscriptionsForms,
    postSubscribeForm,
    patchSubscribeForm,
    deleteSubscribeForm,
    sortWidgetSubscribeForms,
} from 'services/subscriptionService';
import { SubscribeTypeLabel } from 'models/subscription';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockSubscription = { id: 1, participant_id: 1, engagement_id: 1, type: 'EMAIL_LIST', is_subscribed: true };
const mockSubscribeForm = {
    id: 1,
    widget_id: 1,
    type: 'EMAIL_LIST' as SubscribeTypeLabel,
    title: 'Subscribe Form',
    sort_index: 0,
    created_date: '2024-01-01',
    updated_date: '2024-01-01',
    subscribe_items: [],
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('subscriptionService - getSubscription', () => {
    test('returns subscription on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockSubscription });
        const result = await getSubscription(1);
        expect(result).toEqual(mockSubscription);
    });

    test('rejects with message when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getSubscription(1)).rejects.toEqual('Failed to fetch subscription');
    });

    test('rejects immediately when participant_id is 0', async () => {
        await expect(getSubscription(0)).rejects.toEqual('Invalid User Id');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });
});

describe('subscriptionService - createSubscription', () => {
    test('returns created subscription on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockSubscription });
        const result = await createSubscription({ engagement_id: 1, participant_id: 1 } as Parameters<typeof createSubscription>[0]);
        expect(result).toEqual(mockSubscription);
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.post.mockRejectedValueOnce(error);
        await expect(createSubscription({ engagement_id: 1 } as Parameters<typeof createSubscription>[0])).rejects.toEqual(error);
    });
});

describe('subscriptionService - confirmSubscription', () => {
    test('returns confirmed subscription on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: mockSubscription });
        const result = await confirmSubscription(mockSubscription as Parameters<typeof confirmSubscription>[0]);
        expect(result).toEqual(mockSubscription);
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.patch.mockRejectedValueOnce(error);
        await expect(confirmSubscription(mockSubscription as Parameters<typeof confirmSubscription>[0])).rejects.toEqual(error);
    });
});

describe('subscriptionService - unSubscribe', () => {
    test('returns unsubscribe response on success', async () => {
        const mockUnsubscribe = { participant_id: 1, is_subscribed: false };
        mockAxios.patch.mockResolvedValueOnce({ data: mockUnsubscribe });
        const result = await unSubscribe(mockUnsubscribe);
        expect(result).toEqual(mockUnsubscribe);
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.patch.mockRejectedValueOnce(error);
        await expect(unSubscribe({ participant_id: 1, is_subscribed: false })).rejects.toEqual(error);
    });
});

describe('subscriptionService - getSubscriptionsForms', () => {
    test('returns array of forms on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: [mockSubscribeForm] });
        const result = await getSubscriptionsForms(1);
        expect(result).toEqual([mockSubscribeForm]);
    });

    test('returns empty array when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        const result = await getSubscriptionsForms(1);
        expect(result).toEqual([]);
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.get.mockRejectedValueOnce(error);
        await expect(getSubscriptionsForms(1)).rejects.toEqual(error);
    });
});

describe('subscriptionService - postSubscribeForm', () => {
    test('returns created form on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockSubscribeForm });
        const result = await postSubscribeForm(1, { widget_id: 1, type: 'EMAIL_LIST' as SubscribeTypeLabel, items: [] });
        expect(result).toEqual(mockSubscribeForm);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        await expect(
            postSubscribeForm(1, { widget_id: 1, type: 'EMAIL_LIST' as SubscribeTypeLabel, items: [] }),
        ).rejects.toEqual('Failed to create subscription');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.post.mockRejectedValueOnce(error);
        await expect(
            postSubscribeForm(1, { widget_id: 1, type: 'EMAIL_LIST' as SubscribeTypeLabel, items: [] }),
        ).rejects.toEqual(error);
    });
});

describe('subscriptionService - patchSubscribeForm', () => {
    test('returns patched form on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: mockSubscribeForm });
        const result = await patchSubscribeForm(1, 1, 1, { description: 'Updated' });
        expect(result).toEqual(mockSubscribeForm);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: null });
        await expect(patchSubscribeForm(1, 1, 1, { description: 'Updated' })).rejects.toEqual(
            'Failed to patch subscribe',
        );
    });
});

describe('subscriptionService - deleteSubscribeForm', () => {
    test('returns deleted form on success', async () => {
        mockAxios.delete.mockResolvedValueOnce({ data: mockSubscribeForm });
        const result = await deleteSubscribeForm(1, 1);
        expect(result).toEqual(mockSubscribeForm);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.delete.mockResolvedValueOnce({ data: null });
        await expect(deleteSubscribeForm(1, 1)).rejects.toEqual('Failed to delete subscribe');
    });
});

describe('subscriptionService - sortWidgetSubscribeForms', () => {
    test('returns sorted form on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: mockSubscribeForm });
        const result = await sortWidgetSubscribeForms(1, [mockSubscribeForm]);
        expect(result).toEqual(mockSubscribeForm);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: null });
        await expect(sortWidgetSubscribeForms(1, [mockSubscribeForm])).rejects.toEqual(
            'Failed to update sort order',
        );
    });
});

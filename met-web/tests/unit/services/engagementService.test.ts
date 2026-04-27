import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import {
    getEngagement,
    getEngagements,
    postEngagement,
    putEngagement,
    patchEngagement,
    deleteEngagement,
} from 'services/engagementService';
import { draftEngagement, openEngagement } from '../components/factory';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('engagementService - getEngagement', () => {
    test('returns engagement data on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: draftEngagement });
        const result = await getEngagement(1);
        expect(result).toEqual(draftEngagement);
        expect(mockAxios.get).toHaveBeenCalledTimes(1);
    });

    test('rejects with message when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getEngagement(1)).rejects.toEqual('Failed to fetch engagement');
    });

    test('rejects with invalid ID message when engagementId is 0', async () => {
        await expect(getEngagement(0)).rejects.toContain('Invalid Engagement Id');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });

    test('rejects with invalid ID message when engagementId is NaN', async () => {
        await expect(getEngagement(NaN)).rejects.toContain('Invalid Engagement Id');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });
});

describe('engagementService - getEngagements', () => {
    test('returns page of engagements on success', async () => {
        const mockPage = { items: [openEngagement], total: 1 };
        mockAxios.get.mockResolvedValueOnce({ data: mockPage });
        const result = await getEngagements({ page: 1, size: 10 });
        expect(result).toEqual(mockPage);
    });

    test('returns empty page when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        const result = await getEngagements();
        expect(result).toEqual({ items: [], total: 0 });
    });

    test('passes params to the HTTP request', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: { items: [], total: 0 } });
        await getEngagements({ page: 2, size: 25, search_text: 'test' });
        expect(mockAxios.get).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                params: expect.objectContaining({ page: 2, size: 25, search_text: 'test' }),
            }),
        );
    });
});

describe('engagementService - postEngagement', () => {
    test('returns created engagement on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: draftEngagement });
        const result = await postEngagement({ name: 'New Engagement', start_date: '2025-01-01', end_date: '2025-12-31' } as Parameters<typeof postEngagement>[0]);
        expect(result).toEqual(draftEngagement);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        await expect(postEngagement({ name: 'New' } as Parameters<typeof postEngagement>[0])).rejects.toEqual('Failed to create engagement');
    });
});

describe('engagementService - putEngagement', () => {
    test('returns updated engagement on success', async () => {
        mockAxios.put.mockResolvedValueOnce({ data: openEngagement });
        const result = await putEngagement({ id: 2 } as Parameters<typeof putEngagement>[0]);
        expect(result).toEqual(openEngagement);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.put.mockResolvedValueOnce({ data: null });
        await expect(putEngagement({ id: 2 } as Parameters<typeof putEngagement>[0])).rejects.toEqual('Failed to update engagement');
    });
});

describe('engagementService - patchEngagement', () => {
    test('returns patched engagement on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: openEngagement });
        const result = await patchEngagement({ id: 2, status_id: 3 });
        expect(result).toEqual(openEngagement);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: null });
        await expect(patchEngagement({ id: 2, status_id: 3 })).rejects.toEqual('Failed to update engagement');
    });
});

describe('engagementService - deleteEngagement', () => {
    test('resolves on successful delete', async () => {
        mockAxios.delete.mockResolvedValueOnce({ data: undefined });
        await expect(deleteEngagement(1)).resolves.toBeUndefined();
    });
});

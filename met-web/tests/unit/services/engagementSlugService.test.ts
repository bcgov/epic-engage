import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import {
    getSlugByEngagementId,
    getEngagementIdBySlug,
    patchEngagementSlug,
} from 'services/engagementSlugService';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('engagementSlugService - getSlugByEngagementId', () => {
    test('returns slug on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: { slug: 'test-engagement' } });
        const result = await getSlugByEngagementId(1);
        expect(result).toEqual({ slug: 'test-engagement' });
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getSlugByEngagementId(1)).rejects.toEqual('Failed to fetch engagement');
    });

    test('rejects immediately when engagementId is 0', async () => {
        await expect(getSlugByEngagementId(0)).rejects.toContain('Invalid Slug');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });

    test('rejects immediately when engagementId is NaN', async () => {
        await expect(getSlugByEngagementId(NaN)).rejects.toContain('Invalid Slug');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });
});

describe('engagementSlugService - getEngagementIdBySlug', () => {
    test('returns engagement id on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: { engagement_id: 5 } });
        const result = await getEngagementIdBySlug('my-engagement');
        expect(result).toEqual({ engagement_id: 5 });
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getEngagementIdBySlug('my-engagement')).rejects.toEqual('Failed to fetch engagement');
    });

    test('rejects immediately when slug is empty string', async () => {
        await expect(getEngagementIdBySlug('')).rejects.toContain('Invalid Slug');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });
});

describe('engagementSlugService - patchEngagementSlug', () => {
    test('returns updated slug on success', async () => {
        const mockResponse = { engagement_id: 1, slug: 'updated-slug' };
        mockAxios.patch.mockResolvedValueOnce({ data: mockResponse });
        const result = await patchEngagementSlug({ engagement_id: 1, slug: 'updated-slug' });
        expect(result).toEqual(mockResponse);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: null });
        await expect(patchEngagementSlug({ engagement_id: 1, slug: 'test' })).rejects.toEqual(
            'Failed to update engagement metadata',
        );
    });
});

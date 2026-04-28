import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import {
    getEngagementMetadata,
    postEngagementMetadata,
    patchEngagementMetadata,
} from 'services/engagementMetadataService';
import { createDefaultEngagementMetadata } from 'models/engagement';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockMetadata = createDefaultEngagementMetadata();

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('engagementMetadataService - getEngagementMetadata', () => {
    test('returns metadata on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockMetadata });
        const result = await getEngagementMetadata(1);
        expect(result).toEqual(mockMetadata);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getEngagementMetadata(1)).rejects.toEqual('Failed to fetch engagement');
    });

    test('rejects immediately when engagementId is 0', async () => {
        await expect(getEngagementMetadata(0)).rejects.toContain('Invalid Engagement Id');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });

    test('rejects immediately when engagementId is NaN', async () => {
        await expect(getEngagementMetadata(NaN)).rejects.toContain('Invalid Engagement Id');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });
});

describe('engagementMetadataService - postEngagementMetadata', () => {
    test('returns created metadata on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockMetadata });
        const result = await postEngagementMetadata(mockMetadata);
        expect(result).toEqual(mockMetadata);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        await expect(postEngagementMetadata(mockMetadata)).rejects.toEqual(
            'Failed to create engagement metadata',
        );
    });
});

describe('engagementMetadataService - patchEngagementMetadata', () => {
    test('returns updated metadata on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: mockMetadata });
        const result = await patchEngagementMetadata(mockMetadata);
        expect(result).toEqual(mockMetadata);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: null });
        await expect(patchEngagementMetadata(mockMetadata)).rejects.toEqual(
            'Failed to update engagement metadata',
        );
    });
});

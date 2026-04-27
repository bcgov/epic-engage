import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import {
    getEngagementSettings,
    postEngagementSettings,
    patchEngagementSettings,
} from 'services/engagementSettingService';
import { createDefaultEngagementSettings } from 'models/engagement';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockSettings = createDefaultEngagementSettings();

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('engagementSettingService - getEngagementSettings', () => {
    test('returns settings on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockSettings });
        const result = await getEngagementSettings(1);
        expect(result).toEqual(mockSettings);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getEngagementSettings(1)).rejects.toEqual('Failed to fetch engagement');
    });

    test('rejects immediately when engagementId is 0', async () => {
        await expect(getEngagementSettings(0)).rejects.toContain('Invalid Engagement Id');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });

    test('rejects immediately when engagementId is NaN', async () => {
        await expect(getEngagementSettings(NaN)).rejects.toContain('Invalid Engagement Id');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });
});

describe('engagementSettingService - postEngagementSettings', () => {
    test('returns created settings on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockSettings });
        const result = await postEngagementSettings(mockSettings);
        expect(result).toEqual(mockSettings);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        await expect(postEngagementSettings(mockSettings)).rejects.toEqual(
            'Failed to create engagement metadata',
        );
    });
});

describe('engagementSettingService - patchEngagementSettings', () => {
    test('returns updated settings on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: mockSettings });
        const result = await patchEngagementSettings({ engagement_id: 1, send_report: true });
        expect(result).toEqual(mockSettings);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: null });
        await expect(patchEngagementSettings({ engagement_id: 1 })).rejects.toEqual(
            'Failed to update engagement metadata',
        );
    });
});

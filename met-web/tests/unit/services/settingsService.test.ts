import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import { getSettings, getSettingByKey, postSettings, patchSettings } from 'services/settingsService';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockSetting = {
    id: 1,
    setting_key: 'THREAT_CONTACT',
    setting_value: '42',
    setting_value_type: 'integer',
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('settingsService - getSettings', () => {
    test('returns array of settings on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: [mockSetting] });
        const result = await getSettings();
        expect(result).toEqual([mockSetting]);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getSettings()).rejects.toEqual('Failed to fetch settings');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.get.mockRejectedValueOnce(error);
        await expect(getSettings()).rejects.toEqual(error);
    });
});

describe('settingsService - getSettingByKey', () => {
    test('returns setting on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockSetting });
        const result = await getSettingByKey('THREAT_CONTACT');
        expect(result).toEqual(mockSetting);
    });

    // NOTE: getSettingByKey returns null (not rejects) when data is falsy — unique behaviour
    test('returns null when response.data is null (does not reject)', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        const result = await getSettingByKey('MISSING_KEY');
        expect(result).toBeNull();
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.get.mockRejectedValueOnce(error);
        await expect(getSettingByKey('THREAT_CONTACT')).rejects.toEqual(error);
    });
});

describe('settingsService - postSettings', () => {
    test('returns created setting on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockSetting });
        const result = await postSettings({
            setting_key: 'THREAT_CONTACT',
            setting_value: '42',
            setting_value_type: 'integer',
        });
        expect(result).toEqual(mockSetting);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        await expect(
            postSettings({ setting_key: 'K', setting_value: 'V', setting_value_type: 'string' }),
        ).rejects.toEqual('Failed to post settings');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.post.mockRejectedValueOnce(error);
        await expect(
            postSettings({ setting_key: 'K', setting_value: 'V', setting_value_type: 'string' }),
        ).rejects.toEqual(error);
    });
});

describe('settingsService - patchSettings', () => {
    test('returns updated setting on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: { ...mockSetting, setting_value: '99' } });
        const result = await patchSettings('1', '99');
        expect(result).toEqual(expect.objectContaining({ setting_value: '99' }));
    });

    test('rejects when response.data is null', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: null });
        await expect(patchSettings('1', '99')).rejects.toEqual('Failed to patch settings');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.patch.mockRejectedValueOnce(error);
        await expect(patchSettings('1', '99')).rejects.toEqual(error);
    });
});

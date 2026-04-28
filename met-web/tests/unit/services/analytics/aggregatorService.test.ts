import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../../components/setEnvVars';
import { getAggregatorData } from 'services/analytics/aggregatorService';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockAggregatorData = {
    engagement_id: 1,
    total_count: 500,
    count_by_type: [],
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('aggregatorService - getAggregatorData', () => {
    test('returns aggregator data on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockAggregatorData });
        const result = await getAggregatorData({ engagement_id: 1, count_for: 'submissions' });
        expect(result).toEqual(mockAggregatorData);
    });

    test('returns data with no params', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockAggregatorData });
        const result = await getAggregatorData();
        expect(result).toEqual(mockAggregatorData);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getAggregatorData({ engagement_id: 1 })).rejects.toEqual('Failed to fetch aggregate data');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.get.mockRejectedValueOnce(error);
        await expect(getAggregatorData()).rejects.toEqual(error);
    });
});

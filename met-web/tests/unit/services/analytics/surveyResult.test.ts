import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../../components/setEnvVars';
import { getSurveyResultData } from 'services/analytics/surveyResult';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockSurveyResultData = {
    engagement_id: 1,
    dashboard_type: 'public',
    data: [],
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('surveyResult service - getSurveyResultData', () => {
    test('returns survey result data on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockSurveyResultData });
        const result = await getSurveyResultData(1, 'public');
        expect(result).toEqual(mockSurveyResultData);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getSurveyResultData(1, 'public')).rejects.toEqual('Failed to fetch survey result data');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.get.mockRejectedValueOnce(error);
        await expect(getSurveyResultData(1, 'public')).rejects.toEqual(error);
    });
});

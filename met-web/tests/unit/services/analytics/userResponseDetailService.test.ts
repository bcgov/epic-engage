import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../../components/setEnvVars';
import {
    getUserResponseDetailByMonth,
    getUserResponseDetailByWeek,
} from 'services/analytics/userResponseDetailService';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockMonthData = {
    engagement_id: 1,
    data: [{ month: '2024-01', count: 100 }],
};

const mockWeekData = {
    engagement_id: 1,
    data: [{ week: '2024-W01', count: 50 }],
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('userResponseDetailService - getUserResponseDetailByMonth', () => {
    test('returns monthly data on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockMonthData });
        const result = await getUserResponseDetailByMonth(1, '2024-01-01', '2024-01-31');
        expect(result).toEqual(mockMonthData);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getUserResponseDetailByMonth(1, '2024-01-01', '2024-01-31')).rejects.toEqual(
            'Failed to fetch user response detail',
        );
    });

    test('rejects immediately when engagementId is 0', async () => {
        await expect(getUserResponseDetailByMonth(0)).rejects.toContain('Invalid Engagement Id');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });

    test('rejects immediately when engagementId is NaN', async () => {
        await expect(getUserResponseDetailByMonth(NaN)).rejects.toContain('Invalid Engagement Id');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });
});

describe('userResponseDetailService - getUserResponseDetailByWeek', () => {
    test('returns weekly data on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockWeekData });
        const result = await getUserResponseDetailByWeek(1, '2024-01-01', '2024-01-31');
        expect(result).toEqual(mockWeekData);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getUserResponseDetailByWeek(1, '2024-01-01', '2024-01-31')).rejects.toEqual(
            'Failed to fetch user response detail',
        );
    });

    test('rejects immediately when engagementId is 0', async () => {
        await expect(getUserResponseDetailByWeek(0)).rejects.toContain('Invalid Engagement Id');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });

    test('rejects immediately when engagementId is NaN', async () => {
        await expect(getUserResponseDetailByWeek(NaN)).rejects.toContain('Invalid Engagement Id');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });
});

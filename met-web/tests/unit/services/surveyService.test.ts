import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import {
    fetchSurveys,
    getSurveysPage,
    getSurvey,
    postSurvey,
    cloneSurvey,
    putSurvey,
    linkSurvey,
    unlinkSurvey,
    deleteSurvey,
} from 'services/surveyService';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockSurvey = {
    id: 1,
    name: 'Test Survey',
    engagement_id: 1,
    display: 'button',
    form_json: {},
    is_hidden: false,
    is_template: false,
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('surveyService - fetchSurveys', () => {
    test('returns array of surveys on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: { items: [mockSurvey], total: 1 } });
        const result = await fetchSurveys();
        expect(result).toEqual([mockSurvey]);
    });

    test('returns empty array when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        const result = await fetchSurveys();
        expect(result).toEqual([]);
    });

    test('returns empty array when items is undefined', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: {} });
        const result = await fetchSurveys();
        expect(result).toEqual([]);
    });
});

describe('surveyService - getSurveysPage', () => {
    test('returns page of surveys on success', async () => {
        const mockPage = { items: [mockSurvey], total: 1 };
        mockAxios.get.mockResolvedValueOnce({ data: mockPage });
        const result = await getSurveysPage({ page: 1, size: 10 });
        expect(result).toEqual(mockPage);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getSurveysPage()).rejects.toEqual('Failed to fetch survey page');
    });
});

describe('surveyService - getSurvey', () => {
    test('returns survey data on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockSurvey });
        const result = await getSurvey(1);
        expect(result).toEqual(mockSurvey);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getSurvey(1)).rejects.toEqual('Failed to fetch survey');
    });

    test('rejects immediately when surveyId is 0', async () => {
        await expect(getSurvey(0)).rejects.toContain('Invalid Survey Id');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });

    test('rejects immediately when surveyId is NaN', async () => {
        await expect(getSurvey(NaN)).rejects.toContain('Invalid Survey Id');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });
});

describe('surveyService - postSurvey', () => {
    test('returns created survey on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockSurvey });
        const result = await postSurvey({ name: 'New Survey', display: 'button' });
        expect(result).toEqual(mockSurvey);
    });
});

describe('surveyService - cloneSurvey', () => {
    test('returns cloned survey on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockSurvey });
        const result = await cloneSurvey({ name: 'Cloned Survey', survey_id: 1 });
        expect(result).toEqual(mockSurvey);
    });
});

describe('surveyService - putSurvey', () => {
    test('returns updated survey on success', async () => {
        mockAxios.put.mockResolvedValueOnce({ data: mockSurvey });
        const result = await putSurvey({
            id: '1',
            form_json: {},
            name: 'Updated Survey',
            is_hidden: false,
            is_template: false,
        });
        expect(result).toEqual(mockSurvey);
    });
});

describe('surveyService - linkSurvey', () => {
    test('returns linked survey on success', async () => {
        mockAxios.put.mockResolvedValueOnce({ data: mockSurvey });
        const result = await linkSurvey({ id: '1', engagement_id: '2' });
        expect(result).toEqual(mockSurvey);
    });
});

describe('surveyService - unlinkSurvey', () => {
    test('returns unlinked survey on success', async () => {
        mockAxios.delete.mockResolvedValueOnce({ data: mockSurvey });
        const result = await unlinkSurvey({ id: 1, engagement_id: 2 });
        expect(result).toEqual(mockSurvey);
    });
});

describe('surveyService - deleteSurvey', () => {
    test('resolves on successful delete', async () => {
        mockAxios.delete.mockResolvedValueOnce({ data: undefined });
        await expect(deleteSurvey(1)).resolves.toBeUndefined();
    });
});

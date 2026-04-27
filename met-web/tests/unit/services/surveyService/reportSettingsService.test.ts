import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../../components/setEnvVars';
import {
    fetchSurveyReportSettings,
    updateSurveyReportSettings,
} from 'services/surveyService/reportSettingsService';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockReportSetting = {
    id: 1,
    survey_id: 1,
    question_id: 1,
    question_key: 'question_1',
    question_type: 'text',
    question: 'What do you think?',
    display: true,
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('reportSettingsService - fetchSurveyReportSettings', () => {
    test('returns array of settings on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: [mockReportSetting] });
        const result = await fetchSurveyReportSettings('1');
        expect(result).toEqual([mockReportSetting]);
    });

    test('returns empty array when data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        const result = await fetchSurveyReportSettings('1');
        expect(result).toEqual([]);
    });
});

describe('reportSettingsService - updateSurveyReportSettings', () => {
    test('returns updated settings on success', async () => {
        const updatedSettings = [{ ...mockReportSetting, display: false }];
        mockAxios.patch.mockResolvedValueOnce({ data: updatedSettings });
        const result = await updateSurveyReportSettings('1', updatedSettings);
        expect(result).toEqual(updatedSettings);
    });

    test('returns empty array when data is null', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: null });
        const result = await updateSurveyReportSettings('1', []);
        expect(result).toEqual([]);
    });
});

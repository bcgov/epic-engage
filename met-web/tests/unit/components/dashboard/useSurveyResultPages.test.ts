import { act, renderHook, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { useSurveyResultPages } from 'components/public/dashboard/hooks/useSurveyResultPages';
import { DashboardSurveyForm } from 'components/public/dashboard/surveyPages';
import * as surveyResultService from 'services/analytics/surveyResult';
import * as surveyService from 'services/surveyService';
import { TypedSurveyResultData } from 'models/analytics/surveyResult';

jest.mock('services/analytics/surveyResult');
jest.mock('services/surveyService');

const mockGetSurveyResultData = surveyResultService.getSurveyResultData as jest.Mock;
const mockGetSurveyForDashboard = surveyService.getSurveyForDashboard as jest.Mock;

const resultData: TypedSurveyResultData = {
    data: [{ label: 'Q1', position: 0, key: 'q1', type: 'simpleradios', result: [{ value: 'yes', count: 1 }] }],
};

const wizardForm: DashboardSurveyForm = {
    id: 1,
    display: 'wizard',
    pages: [{ title: 'Page 1', questions: ['q1'] }],
    conditional_links: { followup1: { trigger_key: 'q1', row_key: null, row_label: null, trigger_values: ['other'], trigger_value_labels: ['Other'] } },
};

describe('useSurveyResultPages', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('does not fetch when engagementId is not truthy', () => {
        renderHook(() => useSurveyResultPages(undefined, 1, 'public'));

        expect(mockGetSurveyResultData).not.toHaveBeenCalled();
        expect(mockGetSurveyForDashboard).not.toHaveBeenCalled();
    });

    it('fetches survey result and form data, and exposes grouped pages', async () => {
        mockGetSurveyResultData.mockResolvedValue(resultData);
        mockGetSurveyForDashboard.mockResolvedValue(wizardForm);

        const { result } = renderHook(() => useSurveyResultPages(1, 1, 'public'));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockGetSurveyResultData).toHaveBeenCalledWith(1, 'public');
        expect(mockGetSurveyForDashboard).toHaveBeenCalledWith(1);
        expect(result.current.isError).toBe(false);
        expect(result.current.data).toEqual(resultData);
        expect(result.current.pages).toEqual([
            { title: 'Page 1', questions: resultData.data, keys: ['q1'] },
        ]);
        expect(result.current.conditionalLinks).toEqual(wizardForm.conditional_links);
    });

    it('skips fetching the survey form when surveyId is undefined', async () => {
        mockGetSurveyResultData.mockResolvedValue(resultData);

        const { result } = renderHook(() => useSurveyResultPages(1, undefined, 'public'));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockGetSurveyForDashboard).not.toHaveBeenCalled();
        expect(result.current.conditionalLinks).toEqual({});
        // non-wizard fallback (no form) => pages stay null
        expect(result.current.pages).toBeNull();
    });

    it('treats a 404 on the result data as "no data" rather than an error', async () => {
        const notFound = new AxiosError('Not Found');
        notFound.response = { status: 404 } as AxiosError['response'];
        mockGetSurveyResultData.mockRejectedValue(notFound);
        mockGetSurveyForDashboard.mockResolvedValue(undefined);

        const { result } = renderHook(() => useSurveyResultPages(1, 1, 'public'));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isError).toBe(false);
        expect(result.current.data).toBeNull();
    });

    it('surfaces a non-404 failure as an error', async () => {
        mockGetSurveyResultData.mockRejectedValue(new Error('boom'));
        mockGetSurveyForDashboard.mockResolvedValue(undefined);

        const { result } = renderHook(() => useSurveyResultPages(1, 1, 'public'));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isError).toBe(true);
    });

    it('refetch re-runs the fetch', async () => {
        mockGetSurveyResultData.mockResolvedValue(resultData);
        mockGetSurveyForDashboard.mockResolvedValue(wizardForm);

        const { result } = renderHook(() => useSurveyResultPages(1, 1, 'public'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockGetSurveyResultData).toHaveBeenCalledTimes(1);
        await act(async () => {
            await result.current.refetch();
        });

        expect(mockGetSurveyResultData).toHaveBeenCalledTimes(2);
    });
});

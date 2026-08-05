import { act, renderHook, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { useSurveyComments } from 'components/public/dashboard/hooks/useSurveyComments';
import { DashboardSurveyForm } from 'components/public/dashboard/surveyPages';
import * as commentService from 'services/commentService';
import * as surveyService from 'services/surveyService';
import { GroupedComment } from 'models/comment';

jest.mock('services/commentService');
jest.mock('services/surveyService');

const mockGetGroupedComments = commentService.getGroupedComments as jest.Mock;
const mockGetSurveyForDashboard = surveyService.getSurveyForDashboard as jest.Mock;

const groupedComments: GroupedComment[] = [
    { key: 'q1', label: 'What did you think?', type: 'simpletextarea', comments: ['Great', 'Loved it'], count: 2 },
];

const wizardForm: DashboardSurveyForm = {
    id: 1,
    display: 'wizard',
    pages: [{ title: 'Page 1', questions: ['q1'] }],
};

describe('useSurveyComments', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('does not fetch when engagementId is not truthy', () => {
        renderHook(() => useSurveyComments(undefined, 1, 'public'));

        expect(mockGetGroupedComments).not.toHaveBeenCalled();
        expect(mockGetSurveyForDashboard).not.toHaveBeenCalled();
    });

    it('does not fetch comments when surveyId is undefined', async () => {
        const { result } = renderHook(() => useSurveyComments(1, undefined, 'public'));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockGetGroupedComments).not.toHaveBeenCalled();
        expect(result.current.data).toEqual({ data: [] });
    });

    it('converts grouped comments into typed survey data and groups them into pages', async () => {
        mockGetGroupedComments.mockResolvedValue(groupedComments);
        mockGetSurveyForDashboard.mockResolvedValue(wizardForm);

        const { result } = renderHook(() => useSurveyComments(1, 1, 'public'));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockGetGroupedComments).toHaveBeenCalledWith({ survey_id: 1 });
        expect(result.current.data).toEqual({
            data: [
                {
                    label: 'What did you think?',
                    position: 0,
                    key: 'q1',
                    type: 'simpletextarea',
                    result: [
                        { value: 'Great', count: 1 },
                        { value: 'Loved it', count: 1 },
                    ],
                },
            ],
        });
        expect(result.current.pages).toEqual([
            { title: 'Page 1', questions: result.current.data?.data, keys: ['q1'] },
        ]);
    });

    it('treats a 404 as "no data" rather than an error', async () => {
        const notFound = new AxiosError('Not Found');
        notFound.response = { status: 404 } as AxiosError['response'];
        mockGetGroupedComments.mockRejectedValue(notFound);
        mockGetSurveyForDashboard.mockResolvedValue(undefined);

        const { result } = renderHook(() => useSurveyComments(1, 1, 'public'));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isError).toBe(false);
        expect(result.current.data).toBeNull();
    });

    it('surfaces a non-404 failure as an error', async () => {
        mockGetGroupedComments.mockRejectedValue(new Error('boom'));
        mockGetSurveyForDashboard.mockResolvedValue(undefined);

        const { result } = renderHook(() => useSurveyComments(1, 1, 'public'));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isError).toBe(true);
    });

    it('refetch re-runs the fetch', async () => {
        mockGetGroupedComments.mockResolvedValue(groupedComments);
        mockGetSurveyForDashboard.mockResolvedValue(wizardForm);

        const { result } = renderHook(() => useSurveyComments(1, 1, 'public'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockGetGroupedComments).toHaveBeenCalledTimes(1);
        await act(async () => {
            await result.current.refetch();
        });

        expect(mockGetGroupedComments).toHaveBeenCalledTimes(2);
    });
});

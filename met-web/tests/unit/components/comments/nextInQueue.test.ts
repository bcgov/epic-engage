import '@testing-library/jest-dom';
import { resolveNextSubmissionId } from 'components/admin/comments/admin/CommentReview/nextInQueue';
import * as submissionService from 'services/submissionService';
import { CommentStatus } from 'constants/commentStatus';

const mockGetSubmissionPage = jest.spyOn(submissionService, 'getSubmissionPage');

const page = (...ids: number[]) => ({ items: ids.map((id) => ({ id })), total: ids.length } as never);

const CURRENT_ID = 5;
const SURVEY_ID = 1;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('resolveNextSubmissionId', () => {
    test('a Needs Further Review comment stays in the Needs Further Review queue', async () => {
        mockGetSubmissionPage.mockResolvedValueOnce(page(CURRENT_ID, 9));

        const next = await resolveNextSubmissionId(SURVEY_ID, CURRENT_ID, CommentStatus.NeedsFurtherReview);

        expect(next).toBe(9);
        expect(mockGetSubmissionPage).toHaveBeenCalledTimes(1);
        expect(mockGetSubmissionPage.mock.calls[0][0].queryParams).toMatchObject({
            status: CommentStatus.NeedsFurtherReview,
            sort_key: 'review_date',
            sort_order: 'asc',
        });
    });

    test('falls through to Pending once the Needs Further Review queue is exhausted', async () => {
        mockGetSubmissionPage.mockResolvedValueOnce(page(CURRENT_ID)).mockResolvedValueOnce(page(12));

        const next = await resolveNextSubmissionId(SURVEY_ID, CURRENT_ID, CommentStatus.NeedsFurtherReview);

        expect(next).toBe(12);
        expect(mockGetSubmissionPage.mock.calls[1][0].queryParams).toMatchObject({
            status: CommentStatus.Pending,
            sort_key: 'submission.id',
        });
    });

    test('a Pending comment stays in the Pending queue', async () => {
        mockGetSubmissionPage.mockResolvedValueOnce(page(CURRENT_ID, 7));

        const next = await resolveNextSubmissionId(SURVEY_ID, CURRENT_ID, CommentStatus.Pending);

        expect(next).toBe(7);
        expect(mockGetSubmissionPage.mock.calls[0][0].queryParams).toMatchObject({
            status: CommentStatus.Pending,
        });
    });

    test('falls through to Needs Further Review once the Pending queue is exhausted', async () => {
        mockGetSubmissionPage.mockResolvedValueOnce(page()).mockResolvedValueOnce(page(3));

        const next = await resolveNextSubmissionId(SURVEY_ID, CURRENT_ID, CommentStatus.Pending);

        expect(next).toBe(3);
        expect(mockGetSubmissionPage.mock.calls[1][0].queryParams).toMatchObject({
            status: CommentStatus.NeedsFurtherReview,
        });
    });

    test('returns null when both queues are empty', async () => {
        mockGetSubmissionPage.mockResolvedValue(page());

        await expect(resolveNextSubmissionId(SURVEY_ID, CURRENT_ID, CommentStatus.Pending)).resolves.toBeNull();
    });

    test('returns null without calling the API for an already reviewed comment', async () => {
        await expect(resolveNextSubmissionId(SURVEY_ID, CURRENT_ID, CommentStatus.Approved)).resolves.toBeNull();
        await expect(resolveNextSubmissionId(SURVEY_ID, CURRENT_ID, CommentStatus.Rejected)).resolves.toBeNull();
        expect(mockGetSubmissionPage).not.toHaveBeenCalled();
    });

    test('returns null when the lookup fails', async () => {
        mockGetSubmissionPage.mockRejectedValueOnce('boom');

        await expect(resolveNextSubmissionId(SURVEY_ID, CURRENT_ID, CommentStatus.Pending)).resolves.toBeNull();
    });
});

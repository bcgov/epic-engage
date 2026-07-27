import { getSubmissionPage } from 'services/submissionService';
import { CommentStatus } from 'constants/commentStatus';

// A queue is the set of submissions a reviewer works through without leaving the review page.
// Needs Further Review is ordered by review_date so a comment that is re-marked as
// Needs Further Review lands at the back of its own queue instead of being served again.
const PENDING_QUEUE = { status: CommentStatus.Pending, sort_key: 'submission.id' } as const;
const NEEDS_FURTHER_REVIEW_QUEUE = {
    status: CommentStatus.NeedsFurtherReview,
    sort_key: 'review_date',
} as const;

const firstInQueue = async (
    surveyId: number,
    currentId: number,
    queue: typeof PENDING_QUEUE | typeof NEEDS_FURTHER_REVIEW_QUEUE,
): Promise<number | null> => {
    const result = await getSubmissionPage({
        survey_id: surveyId,
        // Two rows is enough: at most one of them can be the submission being reviewed.
        queryParams: { page: 1, size: 2, status: queue.status, sort_key: queue.sort_key, sort_order: 'asc' },
    });
    const next = result.items.find((submission) => Number(submission.id) !== currentId);
    return next?.id ?? null;
};

/**
 * Resolve the submission the 'Save & Review Next' button should navigate to.
 *
 * The reviewer stays in the queue they entered, and falls through to the other queue once
 * theirs is empty. Returns null when neither queue has anything left, which hides the button.
 */
export const resolveNextSubmissionId = async (
    surveyId: number,
    currentId: number,
    openedStatus: number,
): Promise<number | null> => {
    let queues: (typeof PENDING_QUEUE | typeof NEEDS_FURTHER_REVIEW_QUEUE)[];
    if (openedStatus === CommentStatus.NeedsFurtherReview) {
        queues = [NEEDS_FURTHER_REVIEW_QUEUE, PENDING_QUEUE];
    } else if (openedStatus === CommentStatus.Pending) {
        queues = [PENDING_QUEUE, NEEDS_FURTHER_REVIEW_QUEUE];
    } else {
        // Already approved or rejected - the comment is not part of a review queue.
        return null;
    }

    try {
        for (const queue of queues) {
            const next = await firstInQueue(surveyId, currentId, queue);
            if (next !== null) {
                return next;
            }
        }
        return null;
    } catch (err) {
        return null;
    }
};

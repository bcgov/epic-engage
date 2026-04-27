import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import { getFeedbacksPage, createFeedback, updateFeedback, deleteFeedback } from 'services/feedbackService';
import { FeedbackStatusEnum } from 'models/feedback';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockFeedback = {
    id: 1,
    rating: 4,
    comment_type: 1,
    comment: 'Great engagement!',
    status: FeedbackStatusEnum.NotReviewed,
    source_type: 0,
    created_date: '2024-01-01',
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('feedbackService - getFeedbacksPage', () => {
    test('returns page of feedbacks on success', async () => {
        const mockPage = { items: [mockFeedback], total: 1 };
        mockAxios.get.mockResolvedValueOnce({ data: mockPage });
        const result = await getFeedbacksPage({ page: 1, size: 10 });
        expect(result).toEqual(mockPage);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getFeedbacksPage({})).rejects.toEqual('Failed to fetch feedback page');
    });
});

describe('feedbackService - createFeedback', () => {
    test('returns created feedback on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockFeedback });
        const result = await createFeedback({
            rating: 4,
            comment_type: 1,
            comment: 'Great!',
            status: FeedbackStatusEnum.NotReviewed,
        });
        expect(result).toEqual(mockFeedback);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        await expect(
            createFeedback({ rating: 4, comment_type: 1, comment: 'test', status: FeedbackStatusEnum.NotReviewed }),
        ).rejects.toEqual('Failed to create feedback');
    });
});

describe('feedbackService - updateFeedback', () => {
    test('returns updated feedback on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: { ...mockFeedback, status: FeedbackStatusEnum.Archived } });
        const result = await updateFeedback(1, { status: FeedbackStatusEnum.Archived });
        expect(result).toEqual(expect.objectContaining({ status: FeedbackStatusEnum.Archived }));
    });

    test('rejects when response.data is null', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: null });
        await expect(updateFeedback(1, { status: FeedbackStatusEnum.Archived })).rejects.toEqual(
            'Failed to update feedback',
        );
    });
});

describe('feedbackService - deleteFeedback', () => {
    test('resolves when status is 200', async () => {
        mockAxios.delete.mockResolvedValueOnce({ status: 200, data: {} });
        await expect(deleteFeedback(1)).resolves.toBeUndefined();
    });

    test('rejects when status is not 200', async () => {
        mockAxios.delete.mockResolvedValueOnce({ status: 404, data: {} });
        await expect(deleteFeedback(1)).rejects.toEqual('Failed to delete feedback');
    });
});

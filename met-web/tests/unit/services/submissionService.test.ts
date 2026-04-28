import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import {
    getSubmission,
    getSubmissionByToken,
    submitSurvey,
    updateSubmission,
    getSubmissionPage,
    reviewComments,
} from 'services/submissionService';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockSubmission = {
    id: 1,
    survey_id: 1,
    engagement_id: 1,
    submission_json: {},
    comments: [],
};

const mockPublicSubmission = {
    id: 1,
    survey_id: 1,
    engagement_id: 1,
    submission_json: {},
    comments: [],
    verification_token: 'test-token',
};

const mockPage = { items: [mockSubmission], total: 1 };

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('submissionService - getSubmission', () => {
    test('returns submission data on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockSubmission });
        const result = await getSubmission(1);
        expect(result).toEqual(mockSubmission);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getSubmission(1)).rejects.toEqual('Failed to fetch submission');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.get.mockRejectedValueOnce(error);
        await expect(getSubmission(1)).rejects.toEqual(error);
    });
});

describe('submissionService - getSubmissionByToken', () => {
    test('returns public submission on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockPublicSubmission });
        const result = await getSubmissionByToken('test-token');
        expect(result).toEqual(mockPublicSubmission);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getSubmissionByToken('test-token')).rejects.toEqual('Failed to fetch submission');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.get.mockRejectedValueOnce(error);
        await expect(getSubmissionByToken('test-token')).rejects.toEqual(error);
    });
});

describe('submissionService - submitSurvey', () => {
    test('resolves on successful submission', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: {} });
        await expect(
            submitSurvey({ survey_id: 1, submission_json: {}, verification_token: 'token' }),
        ).resolves.toBeUndefined();
    });

    test('rejects on network error', async () => {
        const error = new Error('Submit failed');
        mockAxios.post.mockRejectedValueOnce(error);
        await expect(
            submitSurvey({ survey_id: 1, submission_json: {}, verification_token: 'token' }),
        ).rejects.toEqual(error);
    });
});

describe('submissionService - updateSubmission', () => {
    test('resolves on successful update', async () => {
        mockAxios.put.mockResolvedValueOnce({ data: {} });
        await expect(updateSubmission('test-token', { comments: [] })).resolves.toBeUndefined();
    });

    test('rejects with message on network error', async () => {
        mockAxios.put.mockRejectedValueOnce(new Error('Network error'));
        await expect(updateSubmission('test-token', { comments: [] })).rejects.toEqual(
            'Failed to update submission',
        );
    });
});

describe('submissionService - getSubmissionPage', () => {
    test('returns page of submissions on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockPage });
        const result = await getSubmissionPage({ survey_id: 1 });
        expect(result).toEqual(mockPage);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getSubmissionPage({ survey_id: 1 })).rejects.toEqual('Failed to fetch submission page');
    });
});

describe('submissionService - reviewComments', () => {
    test('returns updated submission on success', async () => {
        mockAxios.put.mockResolvedValueOnce({ data: mockSubmission });
        const result = await reviewComments({ submission_id: 1, status_id: 2, staff_note: [] });
        expect(result).toEqual(mockSubmission);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.put.mockResolvedValueOnce({ data: null });
        await expect(reviewComments({ submission_id: 1, status_id: 2, staff_note: [] })).rejects.toEqual(
            'Failed to update comments',
        );
    });
});

import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import { getCommentsPage, getStaffCommentSheet, getProponentCommentSheet } from 'services/commentService';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockComment = {
    id: 1,
    survey_id: 1,
    submission_id: 1,
    component_id: 'comp1',
    text: 'Test comment',
    submission_date: '2024-01-01',
    reviewed_by: null,
    review_date: null,
    status_id: 1,
    is_displayed: true,
};

const mockPage = {
    items: [mockComment],
    total: 1,
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('commentService - getCommentsPage', () => {
    test('returns page of comments on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockPage });
        const result = await getCommentsPage({ survey_id: 1, page: 1, size: 10 });
        expect(result).toEqual(mockPage);
    });

    test('returns default empty page when data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        const result = await getCommentsPage({ survey_id: 1 });
        expect(result).toEqual({ items: [], total: 0 });
    });

    test('passes all query params to request', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockPage });
        await getCommentsPage({
            survey_id: 1,
            page: 2,
            size: 20,
            sort_key: 'submission_date',
            sort_order: 'desc',
            search_text: 'test',
        });
        expect(mockAxios.get).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                params: expect.objectContaining({
                    page: 2,
                    size: 20,
                    sort_key: 'submission_date',
                    sort_order: 'desc',
                    search_text: 'test',
                }),
            }),
        );
    });
});

describe('commentService - getStaffCommentSheet', () => {
    test('returns blob response for spreadsheet download', async () => {
        const mockBlob = new Blob(['spreadsheet content']);
        mockAxios.get.mockResolvedValueOnce({ data: mockBlob });
        const result = await getStaffCommentSheet({ survey_id: 1 });
        expect(result.data).toBeDefined();
    });

    test('requests arraybuffer response type', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: new Blob() });
        await getStaffCommentSheet({ survey_id: 1 });
        expect(mockAxios.get).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                responseType: 'arraybuffer',
            }),
        );
    });
});

describe('commentService - getProponentCommentSheet', () => {
    test('returns blob response for spreadsheet download', async () => {
        const mockBlob = new Blob(['spreadsheet content']);
        mockAxios.get.mockResolvedValueOnce({ data: mockBlob });
        const result = await getProponentCommentSheet({ survey_id: 1 });
        expect(result.data).toBeDefined();
    });

    test('includes Excel content-type header', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: new Blob() });
        await getProponentCommentSheet({ survey_id: 1 });
        expect(mockAxios.get).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                }),
                responseType: 'arraybuffer',
            }),
        );
    });
});

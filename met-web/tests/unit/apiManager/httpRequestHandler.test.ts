import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import http from 'apiManager/httpRequestHandler';

jest.mock('axios');

const mockAxios = axios as jest.Mocked<typeof axios>;

const TEST_URL = 'https://api.example.com/resource';

beforeEach(() => {
    setupEnv();
    sessionStorage.setItem('tenantId', 'test-tenant');
    sessionStorage.setItem('penguin_session_id', 'test-session-id');
    jest.clearAllMocks();
});

afterEach(() => {
    sessionStorage.clear();
});

describe('httpRequestHandler - GetRequest', () => {
    test('includes Authorization Bearer token header', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: 'result' });
        await http.GetRequest(TEST_URL);
        expect(mockAxios.get).toHaveBeenCalledWith(
            TEST_URL,
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: expect.stringMatching(/^Bearer /),
                }),
            }),
        );
    });

    test('includes tenant-id header', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: 'result' });
        await http.GetRequest(TEST_URL);
        expect(mockAxios.get).toHaveBeenCalledWith(
            TEST_URL,
            expect.objectContaining({
                headers: expect.objectContaining({
                    'tenant-id': 'test-tenant',
                }),
            }),
        );
    });

    test('includes analytics session header', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: 'result' });
        await http.GetRequest(TEST_URL);
        expect(mockAxios.get).toHaveBeenCalledWith(
            TEST_URL,
            expect.objectContaining({
                headers: expect.objectContaining({
                    'X-Analytics-Session-Id': 'test-session-id',
                }),
            }),
        );
    });

    test('passes params to axios', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: [] });
        await http.GetRequest(TEST_URL, { page: 1, size: 10 });
        expect(mockAxios.get).toHaveBeenCalledWith(
            TEST_URL,
            expect.objectContaining({ params: { page: 1, size: 10 } }),
        );
    });

    test('passes responseType when provided', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: new Blob() });
        await http.GetRequest(TEST_URL, {}, {}, 'blob');
        expect(mockAxios.get).toHaveBeenCalledWith(
            TEST_URL,
            expect.objectContaining({ responseType: 'blob' }),
        );
    });
});

describe('httpRequestHandler - PostRequest', () => {
    test('includes Content-type header for JSON data', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: 'created' });
        await http.PostRequest(TEST_URL, { key: 'value' });
        expect(mockAxios.post).toHaveBeenCalledWith(
            TEST_URL,
            { key: 'value' },
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Content-type': 'application/json',
                }),
            }),
        );
    });

    test('removes Content-type header for FormData payload', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: 'created' });
        const formData = new FormData();
        formData.append('file', new Blob(['content']), 'test.txt');
        await http.PostRequest(TEST_URL, formData);
        const [, , config] = mockAxios.post.mock.calls[0];
        expect((config as { headers: Record<string, string> }).headers).not.toHaveProperty('Content-type');
    });
});

describe('httpRequestHandler - PatchRequest', () => {
    test('includes Content-type header for JSON data', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: 'updated' });
        await http.PatchRequest(TEST_URL, { key: 'value' });
        expect(mockAxios.patch).toHaveBeenCalledWith(
            TEST_URL,
            { key: 'value' },
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Content-type': 'application/json',
                }),
            }),
        );
    });

    test('removes Content-type header for FormData payload', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: 'updated' });
        const formData = new FormData();
        await http.PatchRequest(TEST_URL, formData);
        const [, , config] = mockAxios.patch.mock.calls[0];
        expect((config as { headers: Record<string, string> }).headers).not.toHaveProperty('Content-type');
    });
});

describe('httpRequestHandler - DeleteRequest', () => {
    test('includes default headers', async () => {
        mockAxios.delete.mockResolvedValueOnce({ status: 200, data: {} });
        await http.DeleteRequest(TEST_URL);
        expect(mockAxios.delete).toHaveBeenCalledWith(
            TEST_URL,
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: expect.stringMatching(/^Bearer /),
                }),
            }),
        );
    });
});

describe('httpRequestHandler - OSSGetRequest', () => {
    test('uses X-Amz-Date and OSS Authorization (not Bearer)', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: new Blob() });
        await http.OSSGetRequest(TEST_URL, {
            amzDate: '20240101T000000Z',
            authHeader: 'AWS4-HMAC-SHA256 Credential=test',
        });
        expect(mockAxios.get).toHaveBeenCalledWith(
            TEST_URL,
            expect.objectContaining({
                headers: expect.objectContaining({
                    'X-Amz-Date': '20240101T000000Z',
                    Authorization: 'AWS4-HMAC-SHA256 Credential=test',
                }),
                responseType: 'blob',
            }),
        );
    });

    test('includes tenant-id but NOT Bearer Authorization', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: new Blob() });
        await http.OSSGetRequest(TEST_URL, { amzDate: '20240101T000000Z', authHeader: 'AWS4...' });
        const [, config] = mockAxios.get.mock.calls[0];
        expect((config as { headers: Record<string, string> }).headers['tenant-id']).toBe('test-tenant');
        expect((config as { headers: Record<string, string> }).headers['Authorization']).not.toMatch(/^Bearer /);
    });
});

describe('httpRequestHandler - OSSPutRequest', () => {
    test('uses X-Amz-Date and OSS Authorization for upload', async () => {
        mockAxios.put.mockResolvedValueOnce({ data: {} });
        const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
        await http.OSSPutRequest(TEST_URL, file, {
            amzDate: '20240101T000000Z',
            authHeader: 'AWS4-HMAC-SHA256 Credential=test',
        });
        expect(mockAxios.put).toHaveBeenCalledWith(
            TEST_URL,
            file,
            expect.objectContaining({
                headers: expect.objectContaining({
                    'X-Amz-Date': '20240101T000000Z',
                    Authorization: 'AWS4-HMAC-SHA256 Credential=test',
                }),
            }),
        );
    });
});

import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import { downloadObject, saveObject } from 'services/objectStorageService';
import { ObjectStorageFileDetails, ObjectStorageHeaderDetails } from 'services/objectStorageService/types';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockFileDetails: ObjectStorageFileDetails = {
    filename: 'test-document.pdf',
};

const mockHeaderDetails: ObjectStorageHeaderDetails = {
    filename: 'test-document.pdf',
    filepath: 'https://s3.example.com/bucket/test-document.pdf',
    authheader: 'AWS4-HMAC-SHA256 Credential=test',
    amzdate: '20240101T000000Z',
    uniquefilename: 'abc123-test-document.pdf',
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('objectStorageService - downloadObject', () => {
    test('fetches headers then downloads the object', async () => {
        // First call: getOSSHeaderDetails (POST)
        mockAxios.post.mockResolvedValueOnce({ data: [mockHeaderDetails] });
        // Second call: getObject (GET via OSSGetRequest)
        const mockBlob = new Blob(['file content'], { type: 'application/pdf' });
        mockAxios.get.mockResolvedValueOnce({ data: mockBlob });

        const result = await downloadObject(mockFileDetails);
        expect(mockAxios.post).toHaveBeenCalledTimes(1);
        expect(mockAxios.get).toHaveBeenCalledWith(
            mockHeaderDetails.filepath,
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: mockHeaderDetails.authheader }),
            }),
        );
        expect(result).toBeDefined();
    });

    test('throws Error when header details response has no data', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        await expect(downloadObject(mockFileDetails)).rejects.toThrow(
            'Error occurred while fetching document from the object storage',
        );
        expect(mockAxios.get).not.toHaveBeenCalled();
    });
});

describe('objectStorageService - saveObject', () => {
    test('fetches headers then uploads the file and returns header details', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: [mockHeaderDetails] });
        mockAxios.put.mockResolvedValueOnce({ data: {} });

        const mockFile = new File(['content'], 'test-document.pdf', { type: 'application/pdf' });
        const result = await saveObject(mockFile, mockFileDetails);

        expect(mockAxios.post).toHaveBeenCalledTimes(1);
        expect(mockAxios.put).toHaveBeenCalledWith(
            mockHeaderDetails.filepath,
            mockFile,
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: mockHeaderDetails.authheader }),
            }),
        );
        expect(result).toEqual(mockHeaderDetails);
    });

    test('throws Error when header details response has no data', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
        await expect(saveObject(mockFile, mockFileDetails)).rejects.toThrow(
            'Error occurred while fetching document from the object storage',
        );
        expect(mockAxios.put).not.toHaveBeenCalled();
    });
});

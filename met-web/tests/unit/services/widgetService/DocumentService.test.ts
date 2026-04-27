import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../../components/setEnvVars';
import {
    fetchDocuments,
    postDocument,
    deleteDocument,
    patchDocument,
    sortDocuments,
} from 'services/widgetService/DocumentService';
import { DocumentType } from 'models/document';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockDocument = {
    id: 1,
    title: 'Test Document',
    type: 'file' as DocumentType,
    url: 'https://example.com/doc.pdf',
    is_uploaded: true,
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('DocumentService - fetchDocuments', () => {
    test('returns documents array on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: { children: [mockDocument] } });
        const result = await fetchDocuments(1);
        expect(result).toEqual([mockDocument]);
    });

    test('returns empty array when data.children is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: { children: null } });
        const result = await fetchDocuments(1);
        expect(result).toEqual([]);
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.get.mockRejectedValueOnce(error);
        await expect(fetchDocuments(1)).rejects.toEqual(error);
    });
});

describe('DocumentService - postDocument', () => {
    test('returns created document on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockDocument });
        const result = await postDocument(1, { type: 'file' as DocumentType, title: 'New Doc' });
        expect(result).toEqual(mockDocument);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        await expect(postDocument(1, { type: 'file' as DocumentType })).rejects.toEqual('Failed to create document');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.post.mockRejectedValueOnce(error);
        await expect(postDocument(1, { type: 'file' as DocumentType })).rejects.toEqual(error);
    });
});

describe('DocumentService - deleteDocument', () => {
    test('returns deleted document on success', async () => {
        mockAxios.delete.mockResolvedValueOnce({ data: mockDocument });
        const result = await deleteDocument(1, 10);
        expect(result).toEqual(mockDocument);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.delete.mockResolvedValueOnce({ data: null });
        await expect(deleteDocument(1, 10)).rejects.toEqual('Failed to delete document');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.delete.mockRejectedValueOnce(error);
        await expect(deleteDocument(1, 10)).rejects.toEqual(error);
    });
});

describe('DocumentService - patchDocument', () => {
    test('returns updated document on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: { ...mockDocument, title: 'Updated' } });
        const result = await patchDocument(1, 10, { title: 'Updated' });
        expect(result).toEqual(expect.objectContaining({ title: 'Updated' }));
    });

    test('rejects when response.data is null', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: null });
        await expect(patchDocument(1, 10, { title: 'Updated' })).rejects.toEqual('Failed to update document');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.patch.mockRejectedValueOnce(error);
        await expect(patchDocument(1, 10, { title: 'Updated' })).rejects.toEqual(error);
    });
});

describe('DocumentService - sortDocuments', () => {
    test('returns sorted result on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: mockDocument });
        const result = await sortDocuments(1, { documents: [mockDocument] });
        expect(result).toEqual(mockDocument);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: null });
        await expect(sortDocuments(1, { documents: [] })).rejects.toEqual('Failed to update document');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.patch.mockRejectedValueOnce(error);
        await expect(sortDocuments(1, { documents: [] })).rejects.toEqual(error);
    });
});

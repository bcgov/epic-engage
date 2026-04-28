import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import { getImages, postImage, updateImage, deleteImage } from 'services/imageService';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockImage = {
    id: 1,
    unique_name: 'abc123.jpg',
    display_name: 'My Image',
    date_uploaded: '2024-01-01',
    url: 'https://storage.example.com/abc123.jpg',
    archived: false,
};

const mockPage = { items: [mockImage], total: 1 };

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('imageService - getImages', () => {
    test('returns page of images on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockPage });
        const result = await getImages({ page: 1, size: 10 });
        expect(result).toEqual(mockPage);
    });

    // null-coalescing: returns default empty page (not a reject)
    test('returns default empty Page when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        const result = await getImages();
        expect(result).toEqual({ items: [], total: 0 });
    });
});

describe('imageService - postImage', () => {
    test('returns created image on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockImage });
        const result = await postImage({
            unique_name: 'abc123.jpg',
            display_name: 'My Image',
            date_uploaded: new Date('2024-01-01'), // service accepts Date
        });
        expect(result).toEqual(mockImage);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        await expect(
            postImage({ unique_name: 'x.jpg', display_name: 'X', date_uploaded: new Date() }),
        ).rejects.toEqual('Failed to create image');
    });
});

describe('imageService - updateImage', () => {
    test('returns updated image on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: mockImage });
        const result = await updateImage(1, { display_name: 'Updated' });
        expect(result).toEqual(mockImage);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: null });
        await expect(updateImage(1, { display_name: 'Updated' })).rejects.toEqual('Failed to update image');
    });
});

describe('imageService - deleteImage', () => {
    test('resolves on status 200', async () => {
        mockAxios.delete.mockResolvedValueOnce({ status: 200, data: {} });
        await expect(deleteImage(1)).resolves.toBeUndefined();
    });

    test('rejects when status is not 200', async () => {
        mockAxios.delete.mockResolvedValueOnce({ status: 404, data: {} });
        await expect(deleteImage(1)).rejects.toEqual('Failed to delete image');
    });
});

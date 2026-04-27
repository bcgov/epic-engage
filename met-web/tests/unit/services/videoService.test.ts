import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import { fetchVideoWidgets, postVideo, patchVideo } from 'services/widgetService/VideoService';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockVideo = {
    id: 1,
    widget_id: 5,
    engagement_id: 2,
    video_url: 'https://youtube.com/watch?v=test',
    description: 'Test video',
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('VideoService - fetchVideoWidgets', () => {
    test('returns array of videos on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: [mockVideo] });
        const result = await fetchVideoWidgets(5);
        expect(result).toEqual([mockVideo]);
    });

    test('returns empty array when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        const result = await fetchVideoWidgets(5);
        expect(result).toEqual([]);
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.get.mockRejectedValueOnce(error);
        await expect(fetchVideoWidgets(5)).rejects.toEqual(error);
    });
});

describe('VideoService - postVideo', () => {
    test('returns created video on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockVideo });
        const result = await postVideo(5, {
            widget_id: 5,
            engagement_id: 2,
            video_url: 'https://youtube.com/watch?v=test',
            description: 'Test video',
        });
        expect(result).toEqual(mockVideo);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        await expect(
            postVideo(5, { widget_id: 5, engagement_id: 2, video_url: 'url', description: 'desc' }),
        ).rejects.toEqual('Failed to create video widget');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.post.mockRejectedValueOnce(error);
        await expect(
            postVideo(5, { widget_id: 5, engagement_id: 2, video_url: 'url', description: 'desc' }),
        ).rejects.toEqual(error);
    });
});

describe('VideoService - patchVideo', () => {
    test('returns updated video on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: mockVideo });
        const result = await patchVideo(5, 1, { description: 'Updated description' });
        expect(result).toEqual(mockVideo);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: null });
        await expect(patchVideo(5, 1, { description: 'Updated' })).rejects.toEqual(
            'Failed to create video widget',
        );
    });
});

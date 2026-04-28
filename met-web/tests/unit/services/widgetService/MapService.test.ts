import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../../components/setEnvVars';
import { fetchMaps, postMap, previewShapeFile } from 'services/widgetService/MapService';
import { WidgetMap } from 'models/widgetMap';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockMap: WidgetMap = {
    id: 1,
    widget_id: 1,
    engagement_id: 1,
    longitude: -123.1,
    latitude: 49.2,
    marker_label: 'Test Location',
    geojson: '',
    file_name: '',
};

const mockGeoJSON = {
    type: 'FeatureCollection',
    features: [],
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('MapService - fetchMaps', () => {
    test('returns maps array on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: [mockMap] });
        const result = await fetchMaps(1);
        expect(result).toEqual([mockMap]);
    });

    test('returns empty array when data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        const result = await fetchMaps(1);
        expect(result).toEqual([]);
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.get.mockRejectedValueOnce(error);
        await expect(fetchMaps(1)).rejects.toEqual(error);
    });
});

describe('MapService - postMap', () => {
    test('returns created map on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockMap });
        const result = await postMap(1, {
            widget_id: 1,
            engagement_id: 1,
            longitude: -123.1,
            latitude: 49.2,
            marker_label: 'Test',
        });
        expect(result).toEqual(mockMap);
    });

    test('includes file in FormData when provided', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockMap });
        const mockFile = new File(['content'], 'shapefile.zip', { type: 'application/zip' });
        await postMap(1, {
            widget_id: 1,
            engagement_id: 1,
            longitude: -123.1,
            latitude: 49.2,
            file: mockFile,
        });
        expect(mockAxios.post).toHaveBeenCalledTimes(1);
        // Verify FormData was passed (second argument)
        const [, formData] = mockAxios.post.mock.calls[0];
        expect(formData).toBeInstanceOf(FormData);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        await expect(
            postMap(1, { widget_id: 1, engagement_id: 1, longitude: 0, latitude: 0 }),
        ).rejects.toEqual('Failed to create map');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.post.mockRejectedValueOnce(error);
        await expect(
            postMap(1, { widget_id: 1, engagement_id: 1, longitude: 0, latitude: 0 }),
        ).rejects.toEqual(error);
    });
});

describe('MapService - previewShapeFile', () => {
    test('returns GeoJSON on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockGeoJSON });
        const mockFile = new File(['content'], 'shapefile.zip', { type: 'application/zip' });
        const result = await previewShapeFile({ file: mockFile });
        expect(result).toEqual(mockGeoJSON);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        await expect(previewShapeFile({})).rejects.toEqual('Failed to preview shapefile');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.post.mockRejectedValueOnce(error);
        await expect(previewShapeFile({})).rejects.toEqual(error);
    });
});

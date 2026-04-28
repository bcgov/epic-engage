import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import {
    getWidgets,
    getWidget,
    postWidget,
    postWidgetItems,
    removeWidget,
    sortWidgets,
} from 'services/widgetService';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockWidget = {
    id: 1,
    widget_type_id: 1,
    engagement_id: 1,
    items: [],
    title: '',
};

const mockWidgetItem = {
    id: 1,
    widget_id: 1,
    widget_data_id: 1,
    sort_index: 0,
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('widgetService - getWidgets', () => {
    test('returns array of widgets on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: [mockWidget] });
        const result = await getWidgets(1);
        expect(result).toEqual([mockWidget]);
    });

    test('returns empty array when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        const result = await getWidgets(1);
        expect(result).toEqual([]);
    });
});

describe('widgetService - getWidget', () => {
    test('returns single widget on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockWidget });
        const result = await getWidget(1, 1);
        expect(result).toEqual(mockWidget);
    });
});

describe('widgetService - postWidget', () => {
    test('returns created widget on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockWidget });
        const result = await postWidget(1, { widget_type_id: 1, engagement_id: 1 });
        expect(result).toEqual(mockWidget);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        await expect(postWidget(1, { widget_type_id: 1, engagement_id: 1 })).rejects.toEqual(
            'Failed to create contact',
        );
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.post.mockRejectedValueOnce(error);
        await expect(postWidget(1, { widget_type_id: 1, engagement_id: 1 })).rejects.toEqual(error);
    });
});

describe('widgetService - postWidgetItems', () => {
    test('returns created widget items on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: [mockWidgetItem] });
        const result = await postWidgetItems(1, [{ widget_id: 1, widget_data_id: 1 }]);
        expect(result).toEqual([mockWidgetItem]);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        await expect(postWidgetItems(1, [{ widget_id: 1, widget_data_id: 1 }])).rejects.toEqual(
            'Failed to create wdiget item',
        );
    });
});

describe('widgetService - removeWidget', () => {
    test('returns remaining widgets on success', async () => {
        mockAxios.delete.mockResolvedValueOnce({ data: [] });
        const result = await removeWidget(1, 1);
        expect(result).toEqual([]);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.delete.mockResolvedValueOnce({ data: null });
        await expect(removeWidget(1, 1)).rejects.toEqual('Failed to delete widget');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.delete.mockRejectedValueOnce(error);
        await expect(removeWidget(1, 1)).rejects.toEqual(error);
    });
});

describe('widgetService - sortWidgets', () => {
    test('resolves on successful sort', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: undefined });
        await expect(sortWidgets(1, [mockWidget])).resolves.toBeUndefined();
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.patch.mockRejectedValueOnce(error);
        await expect(sortWidgets(1, [mockWidget])).rejects.toEqual(error);
    });
});

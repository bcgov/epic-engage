import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../../components/setEnvVars';
import { getEvents, postEvent, patchEvent, deleteEvent, sortWidgetEvents } from 'services/widgetService/EventService';
import { Event } from 'models/event';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockEvent: Event = {
    id: 1,
    widget_id: 1,
    title: 'Test Event',
    type: 'OPENHOUSE',
    sort_index: 0,
    created_by: 'test',
    updated_by: 'test',
    event_items: [
        {
            id: 1,
            description: 'Event description',
            location_name: 'Location',
            location_address: '123 Main St',
            start_date: '2024-06-01',
            end_date: '2024-06-02',
            timezone: 'America/Vancouver',
            url: 'https://example.com',
            url_label: 'Event Link',
            sort_index: 0,
            widget_events_id: 1,
            created_by: 'test',
            updated_by: 'test',
            created_date: '2024-01-01',
            updated_date: '2024-01-01',
        },
    ],
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('EventService - getEvents', () => {
    test('returns events array on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: [mockEvent] });
        const result = await getEvents(1);
        expect(result).toEqual([mockEvent]);
    });

    test('returns empty array when data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        const result = await getEvents(1);
        expect(result).toEqual([]);
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.get.mockRejectedValueOnce(error);
        await expect(getEvents(1)).rejects.toEqual(error);
    });
});

describe('EventService - postEvent', () => {
    test('returns created event on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockEvent });
        const result = await postEvent(1, {
            widget_id: 1,
            type: 'OPENHOUSE',
            items: [
                {
                    start_date: '2024-06-01',
                    end_date: '2024-06-02',
                    timezone: 'America/Vancouver',
                },
            ],
        });
        expect(result).toEqual(mockEvent);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: null });
        await expect(
            postEvent(1, {
                widget_id: 1,
                type: 'OPENHOUSE',
                items: [{ start_date: '2024-06-01', end_date: '2024-06-02', timezone: 'UTC' }],
            }),
        ).rejects.toEqual('Failed to create event');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.post.mockRejectedValueOnce(error);
        await expect(
            postEvent(1, {
                widget_id: 1,
                type: 'OPENHOUSE',
                items: [{ start_date: '2024-06-01', end_date: '2024-06-02', timezone: 'UTC' }],
            }),
        ).rejects.toEqual(error);
    });
});

describe('EventService - patchEvent', () => {
    test('returns updated event on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: { ...mockEvent, title: 'Updated Event' } });
        const result = await patchEvent(1, 1, 1, { description: 'Updated description' });
        expect(result).toEqual(expect.objectContaining({ title: 'Updated Event' }));
    });

    test('rejects when response.data is null', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: null });
        await expect(patchEvent(1, 1, 1, { description: 'Updated' })).rejects.toEqual('Failed to patch event');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.patch.mockRejectedValueOnce(error);
        await expect(patchEvent(1, 1, 1, { description: 'Updated' })).rejects.toEqual(error);
    });
});

describe('EventService - deleteEvent', () => {
    test('returns deleted event on success', async () => {
        mockAxios.delete.mockResolvedValueOnce({ data: mockEvent });
        const result = await deleteEvent(1, 1);
        expect(result).toEqual(mockEvent);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.delete.mockResolvedValueOnce({ data: null });
        await expect(deleteEvent(1, 1)).rejects.toEqual('Failed to delete event');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.delete.mockRejectedValueOnce(error);
        await expect(deleteEvent(1, 1)).rejects.toEqual(error);
    });
});

describe('EventService - sortWidgetEvents', () => {
    test('returns sorted result on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: mockEvent });
        const result = await sortWidgetEvents(1, [mockEvent]);
        expect(result).toEqual(mockEvent);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: null });
        await expect(sortWidgetEvents(1, [])).rejects.toEqual('Failed to update sort order');
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.patch.mockRejectedValueOnce(error);
        await expect(sortWidgetEvents(1, [])).rejects.toEqual(error);
    });
});

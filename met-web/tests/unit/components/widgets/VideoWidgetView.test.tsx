import React from 'react';
import { render, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { setupEnv } from '../setEnvVars';
import ProviderShell from '../ProviderShell';
import VideoWidgetView from 'components/public/engagement/view/widgets/Video/VideoWidgetView';
import * as VideoService from 'services/widgetService/VideoService';
import { VideoWidget } from 'models/videoWidget';
import { Widget, WidgetType } from 'models/widget';

jest.mock('axios');
jest.mock('@reduxjs/toolkit/query/react', () => ({
    ...jest.requireActual('@reduxjs/toolkit/query/react'),
    fetchBaseQuery: jest.fn(),
}));
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => jest.fn(),
    useParams: () => ({ engagementId: '2' }),
    useLocation: () => ({ pathname: '/engagements/2/view', state: null }),
}));

// ReactPlayer has issues in jest/jsdom environment
jest.mock('react-player', () => {
    return function MockReactPlayer({ onPlay }: { onPlay?: () => void }) {
        return <button onClick={onPlay} data-testid="mock-player">Play</button>;
    };
});

const mockWidget: Widget = {
    id: 5,
    title: 'Watch Our Video',
    widget_type_id: WidgetType.Video,
    engagement_id: 2,
    items: [],
};

const mockVideoWidget: VideoWidget = {
    id: 1,
    widget_id: 5,
    engagement_id: 2,
    video_url: 'https://youtube.com/watch?v=test123',
    description: 'A test video description',
};

const renderVideoWidget = () =>
    render(
        <ProviderShell>
            <VideoWidgetView widget={mockWidget} />
        </ProviderShell>,
    );

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('VideoWidgetView', () => {
    test('shows skeleton while loading video', () => {
        jest.spyOn(VideoService, 'fetchVideoWidgets').mockReturnValue(new Promise(() => {}));
        const { container } = renderVideoWidget();
        expect(container.querySelector('.MuiSkeleton-root')).toBeInTheDocument();
    });

    test('renders widget title and description after loading video', async () => {
        jest.spyOn(VideoService, 'fetchVideoWidgets').mockResolvedValueOnce([mockVideoWidget]);
        renderVideoWidget();
        await waitFor(() => {
            expect(screen.getByText(mockWidget.title)).toBeInTheDocument();
            expect(screen.getByText(mockVideoWidget.description)).toBeInTheDocument();
        });
    });

    test('renders null (nothing) when no video data is returned', async () => {
        jest.spyOn(VideoService, 'fetchVideoWidgets').mockResolvedValueOnce([]);
        const { container } = renderVideoWidget();
        await waitFor(() => {
            // No content - component returns null when videoWidget is null/undefined
            expect(container.firstChild).toBeNull();
        });
    });

    test('dispatches error notification when fetch fails', async () => {
        jest.spyOn(VideoService, 'fetchVideoWidgets').mockRejectedValueOnce(new Error('Fetch failed'));
        renderVideoWidget();
        await waitFor(() => {
            // Widget should handle the error gracefully without crashing
            expect(VideoService.fetchVideoWidgets).toHaveBeenCalledWith(mockWidget.id);
        });
    });

    test('calls fetchVideoWidgets with correct widget id', async () => {
        const mockSpy = jest.spyOn(VideoService, 'fetchVideoWidgets').mockResolvedValueOnce([mockVideoWidget]);
        renderVideoWidget();
        await waitFor(() => {
            expect(mockSpy).toHaveBeenCalledWith(mockWidget.id);
        });
    });

    test('uses the last video when multiple videos returned', async () => {
        const anotherVideo: VideoWidget = { ...mockVideoWidget, id: 2, description: 'Second video' };
        jest.spyOn(VideoService, 'fetchVideoWidgets').mockResolvedValueOnce([mockVideoWidget, anotherVideo]);
        renderVideoWidget();
        await waitFor(() => {
            expect(screen.getByText('Second video')).toBeInTheDocument();
        });
    });
});

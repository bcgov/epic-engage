import React from 'react';
import { VideoContextProvider } from './VideoContext';
import VideoForm from './VideoForm';

export const VideoWidget = () => {
    return (
        <VideoContextProvider>
            <VideoForm />
        </VideoContextProvider>
    );
};

export default VideoWidget;

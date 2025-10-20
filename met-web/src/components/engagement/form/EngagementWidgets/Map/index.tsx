import React from 'react';
import MapForm from './MapForm';
import { MapProvider } from './MapContext';
import { PreviewModal } from './PreviewModal';

export const MapWidget = () => {
    return (
        <MapProvider>
            <MapForm />
            <PreviewModal />
        </MapProvider>
    );
};

export default MapWidget;

import React from 'react';
import Map, { Marker, NavigationControl, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GeoJSON } from 'geojson';
import MarkerIcon from '@mui/icons-material/LocationOnRounded';
import { Stack } from '@mui/material';
import { When } from 'react-if';
import { MetSmallText } from 'components/common';
import { Palette } from 'styles/Theme';

interface MapProps {
    latitude: number;
    longitude: number;
    markerLabel?: string;
    geojson?: GeoJSON;
    zoom: number;
}

export const MAP_STYLE = window.location.origin + '/basic-map.json';

const MetMap = ({ geojson, latitude, longitude, markerLabel, zoom }: MapProps) => {
    return (
        <Map
            id="map-gl-container"
            initialViewState={{
                longitude: longitude,
                latitude: latitude,
                zoom: zoom,
            }}
            mapStyle={MAP_STYLE}
            style={{
                width: '100%',
                height: '100%',
            }}
        >
            <NavigationControl />
            <When condition={Boolean(geojson)}>
                <Source id="geojson-data" type="geojson" data={geojson}>
                    <Layer
                        id="lines"
                        type="line"
                        source="geojson-data"
                        filter={['all', ['==', ['geometry-type'], 'LineString'], ['!=', ['get', 'type'], 'platform']]}
                        layout={{
                            'line-join': 'round',
                            'line-cap': 'round',
                        }}
                        paint={{
                            'line-width': 1,
                            'line-color': Palette.primary.main,
                        }}
                    />
                    <Layer
                        id="fill-layer"
                        type="fill"
                        source="geojson-data"
                        paint={{
                            'fill-color': Palette.primary.main,
                            'fill-opacity': 0.5,
                        }}
                        filter={['all', ['==', ['geometry-type'], 'Polygon']]}
                    />
                </Source>
            </When>
            <Marker longitude={longitude} latitude={latitude} anchor="bottom">
                <Stack direction="column" alignItems="center" justifyContent="center">
                    <MarkerIcon fontSize="large" htmlColor="red" />
                    <When condition={Boolean(markerLabel)}>
                        <MetSmallText bold bgcolor={'white'} borderRadius="10px" padding="0 2px 0 2px">
                            {markerLabel}
                        </MetSmallText>
                    </When>
                </Stack>
            </Marker>
        </Map>
    );
};

export default MetMap;

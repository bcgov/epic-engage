import React from 'react';
import Map, { Marker, NavigationControl, Source, Layer, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GeoJSON } from 'geojson';
import MarkerIcon from '@mui/icons-material/LocationOnRounded';
import { Stack } from '@mui/material';
import { When } from 'react-if';
import { MetSmallText } from 'components/shared/common';
import { Palette } from 'styles/Theme';

interface MapProps {
    latitude: number;
    longitude: number;
    markerLabel?: string;
    geojson?: GeoJSON;
    zoom: number;
}

export const MAP_STYLE = window.location.origin + '/basic-map.json';

const polygonColorExpression = [
    'case',
    ['has', 'shape_render_index'],
    [
        'match',
        ['%', ['to-number', ['get', 'shape_render_index']], 10],
        0,
        '#2a9d8f',
        1,
        '#e76f51',
        2,
        '#457b9d',
        3,
        '#f4a261',
        4,
        '#264653',
        5,
        '#ff7f51',
        6,
        '#8ab17d',
        7,
        '#6d597a',
        8,
        '#277da1',
        9,
        '#bc4749',
        '#6d597a',
    ],
    ['has', 'shape_group_index'],
    [
        'match',
        ['%', ['to-number', ['get', 'shape_group_index']], 10],
        0,
        '#2a9d8f',
        1,
        '#e76f51',
        2,
        '#457b9d',
        3,
        '#f4a261',
        4,
        '#264653',
        5,
        '#ff7f51',
        6,
        '#8ab17d',
        7,
        '#6d597a',
        8,
        '#277da1',
        9,
        '#bc4749',
        '#6d597a',
    ],
    Palette.primary.main,
];

const MetMap = ({ geojson, latitude, longitude, markerLabel, zoom }: MapProps) => {
    const [hoverLabel, setHoverLabel] = React.useState<{
        label: string;
        longitude: number;
        latitude: number;
    } | null>(null);

    const handlePolygonHover = (event: maplibregl.MapLayerMouseEvent) => {
        const feature = event?.features?.[0];
        const properties = feature?.properties;
        const label = properties?.Label;
        if (label) {
            setHoverLabel({
                label,
                longitude: event.lngLat.lng,
                latitude: event.lngLat.lat,
            });
            return;
        }
        setHoverLabel(null);
    };

    return (
        <Map
            id="map-gl-container"
            initialViewState={{
                longitude: longitude,
                latitude: latitude,
                zoom: zoom,
            }}
            mapStyle={MAP_STYLE}
            interactiveLayerIds={['fill-layer', 'polygon-outline']}
            onMouseMove={handlePolygonHover}
            onMouseLeave={() => setHoverLabel(null)}
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
                            'fill-color': polygonColorExpression as unknown as string,
                            'fill-opacity': 0.45,
                        }}
                        filter={['all', ['==', ['geometry-type'], 'Polygon']]}
                    />
                    <Layer
                        id="polygon-outline"
                        type="line"
                        source="geojson-data"
                        paint={{
                            'line-color': '#1f2937',
                            'line-width': 1.5,
                        }}
                        filter={['all', ['==', ['geometry-type'], 'Polygon']]}
                    />
                </Source>
            </When>
            <When condition={Boolean(hoverLabel)}>
                <Popup
                    longitude={hoverLabel?.longitude || longitude}
                    latitude={hoverLabel?.latitude || latitude}
                    closeButton={false}
                    closeOnClick={false}
                    anchor="bottom"
                    maxWidth="200px"
                >
                    <When condition={Boolean(hoverLabel?.label)}>
                        <MetSmallText
                            sx={{
                                whiteSpace: 'normal',
                                overflowWrap: 'anywhere',
                                wordBreak: 'break-word',
                            }}
                        >
                            Label: {hoverLabel?.label}
                        </MetSmallText>
                    </When>
                </Popup>
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

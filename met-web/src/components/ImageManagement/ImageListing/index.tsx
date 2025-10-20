import React from 'react';
import { ImageProvider } from './ImageContext';
import ImageListing from './ImageListing';

const Images = () => {
    return (
        <ImageProvider>
            <ImageListing />
        </ImageProvider>
    );
};

export default Images;

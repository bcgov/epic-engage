import React from 'react';
import { CropModal } from './CropModal';
import { ImageUploadContextProvider } from './ImageUploadContext';
import Uploader from './Uploader';
import { Accept } from 'react-dropzone';

interface UploaderProps {
    margin?: number;
    handleAddFile: (_files: File[]) => void;
    savedImageUrl?: string;
    savedImageName?: string;
    helpText?: string;
    height?: string;
    cropAspectRatio?: number;
    accept?: Accept;
    canCrop?: boolean;
    cropText?: string;
    saveAndExitText?: string;
    saveText?: string;
    saveAndExitRequired?: boolean;
}
export const ImageUpload = ({
    saveAndExitText,
    cropAspectRatio,
    margin = 2,
    handleAddFile,
    savedImageUrl = '',
    savedImageName = '',
    helpText = 'Drag and drop an image here, or click to select an image from your device. Formats accepted are: jpg, png, webp.',
    height = '10em',
    cropText = '',
    accept = {
        'image/jpeg': [],
        'image/png': [],
        'image/webp': [],
    },
    saveText = 'Save',
    saveAndExitRequired = false,
}: UploaderProps) => {
    return (
        <ImageUploadContextProvider
            handleAddFile={handleAddFile}
            savedImageUrl={savedImageUrl}
            savedImageName={savedImageName}
            cropAspectRatio={cropAspectRatio}
        >
            <Uploader margin={margin} helpText={helpText} height={height} accept={accept} />
            <CropModal
                cropText={cropText}
                saveAndExitText={saveAndExitText}
                saveAndExitRequired={saveAndExitRequired}
                saveText={saveText}
            />
        </ImageUploadContextProvider>
    );
};

export default ImageUpload;

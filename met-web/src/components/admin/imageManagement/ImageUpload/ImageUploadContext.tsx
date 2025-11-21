import React, { createContext, useState } from 'react';
import { Crop } from 'react-image-crop';

export interface ImageUploadContextState {
    cropModalOpen: boolean;
    setCropModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    handleAddFile: (_files: File[]) => void;
    savedImageUrl: string;
    savedImageName: string;
    addedImageFileUrl: string;
    setAddedImageFileUrl: React.Dispatch<React.SetStateAction<string>>;
    addedImageFileName: string;
    setAddedImageFileName: React.Dispatch<React.SetStateAction<string>>;
    existingImageUrl: string;
    setExistingImageURL: React.Dispatch<React.SetStateAction<string>>;
    imgAfterCrop: string;
    setImgAfterCrop: React.Dispatch<React.SetStateAction<string>>;
    cropAspectRatio?: number;
    cropSettings: Crop | undefined;
    setCropSettings: React.Dispatch<React.SetStateAction<Crop | undefined>>;
}

export const ImageUploadContext = createContext<ImageUploadContextState>({
    cropModalOpen: false,
    setCropModalOpen: () => {
        throw new Error('setCropModalOpen not implemented');
    },
    handleAddFile: () => {
        throw new Error('handleAddFile not implemented');
    },
    savedImageUrl: '',
    savedImageName: '',
    addedImageFileUrl: '',
    setAddedImageFileUrl: () => {
        throw new Error('setAddedImageFileUrl not implemented');
    },
    addedImageFileName: '',
    setAddedImageFileName: () => {
        throw new Error('setAddedImageFileName not implemented');
    },
    existingImageUrl: '',
    setExistingImageURL: () => {
        throw new Error('setExistingImageURL not implemented');
    },
    imgAfterCrop: '',
    setImgAfterCrop: () => {
        throw new Error('setExistingImageURL not implemented');
    },
    cropAspectRatio: undefined,
    cropSettings: undefined,
    setCropSettings: () => {
        throw new Error('setCropSettings not implemented');
    },
});

interface ImageUploadContextProviderProps {
    handleAddFile: (_files: File[]) => void;
    children: React.ReactNode;
    savedImageUrl: string;
    savedImageName: string;
    cropAspectRatio?: number;
}
export const ImageUploadContextProvider = ({
    children,
    handleAddFile,
    savedImageUrl,
    savedImageName,
    cropAspectRatio,
}: ImageUploadContextProviderProps) => {
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [addedImageFileUrl, setAddedImageFileUrl] = useState('');
    const [addedImageFileName, setAddedImageFileName] = useState('');

    const [existingImageUrl, setExistingImageURL] = useState(savedImageUrl);
    const [imgAfterCrop, setImgAfterCrop] = useState('');

    const [cropSettings, setCropSettings] = useState<Crop | undefined>(undefined);

    return (
        <ImageUploadContext.Provider
            value={{
                cropModalOpen,
                setCropModalOpen,
                handleAddFile,
                savedImageUrl,
                savedImageName,
                addedImageFileUrl,
                setAddedImageFileUrl,
                addedImageFileName,
                setAddedImageFileName,
                existingImageUrl,
                setExistingImageURL,
                imgAfterCrop,
                setImgAfterCrop,
                cropAspectRatio,
                cropSettings,
                setCropSettings,
            }}
        >
            {children}
        </ImageUploadContext.Provider>
    );
};

import React, { useContext, useRef, useState } from 'react';
import Modal from '@mui/material/Modal';
import { Grid, Paper, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { MetDescription, modalStyle, PrimaryButton, SecondaryButton } from 'components/shared/common';
import { ImageUploadContext } from './ImageUploadContext';
import { Box } from '@mui/system';
import ReactCrop, { PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { blobToFile } from 'utils';
import { ImageContext } from '../ImageListing/ImageContext';
import { Else, If, Then } from 'react-if';

interface CropModalProps {
    cropText?: string;
    saveAndExitRequired?: boolean;
    saveAndExitText?: string;
    saveText?: string;
}

const getCroppedImage = (image: HTMLImageElement, crop: PixelCrop): Promise<Blob | null> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return Promise.resolve(null);

    ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width,
        crop.height,
    );

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/jpeg');
    });
};

export const CropModal = ({
    cropText,
    saveAndExitText,
    saveAndExitRequired = false,
    saveText = 'false',
}: CropModalProps) => {
    const {
        existingImageUrl,
        addedImageFileUrl,
        setImgAfterCrop,
        cropModalOpen,
        setCropModalOpen,
        handleAddFile,
        savedImageName,
        addedImageFileName,
        cropSettings,
        setCropSettings,
        cropAspectRatio,
    } = useContext(ImageUploadContext);

    const { handleUploadImage } = useContext(ImageContext);

    const imageRef = useRef<HTMLImageElement | null>(null);

    const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);

    const onImageLoaded = (img: HTMLImageElement) => {
        imageRef.current = img;
        if (cropSettings === undefined) {
            setCropSettings({
                unit: '%',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
            });
        }
    };

    const handleCropDone = async () => {
        if (!completedCrop || !imageRef.current) return;
        const croppedImageBlob = await getCroppedImage(imageRef.current, completedCrop);
        if (!croppedImageBlob) return;
        setImgAfterCrop(URL.createObjectURL(croppedImageBlob));
        const imageFile = blobToFile(croppedImageBlob, addedImageFileName || savedImageName);
        handleAddFile([imageFile]);
        setCropModalOpen(false);
        return imageFile;
    };

    const currentImageUrl = addedImageFileUrl || `${existingImageUrl}?dummy-variable`;

    return (
        <Modal open={cropModalOpen} onClose={() => setCropModalOpen(false)} keepMounted={false}>
            <Paper
                sx={{
                    ...modalStyle,
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '900px',
                    overflow: 'hidden',
                    p: 3,
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        backgroundColor: '#fff',
                        minHeight: '40px',
                        mb: 1,
                    }}
                >
                    <IconButton
                        onClick={() => setCropModalOpen(false)}
                        sx={{
                            color: '#000',
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        overflow: 'hidden',
                        mb: 2,
                        minHeight: 0,
                    }}
                >
                    <ReactCrop
                        crop={cropSettings}
                        aspect={cropAspectRatio}
                        onChange={(c) => setCropSettings(c)}
                        onComplete={(c) => setCompletedCrop(c)}
                        minWidth={10}
                        minHeight={10}
                        style={{ maxHeight: 'calc(90vh - 250px)', display: 'flex' }}
                    >
                        <img
                            src={currentImageUrl}
                            crossOrigin="anonymous"
                            ref={imageRef}
                            onLoad={(e) => onImageLoaded(e.currentTarget)}
                            style={{
                                display: 'block',
                                maxHeight: 'calc(90vh - 250px)',
                                maxWidth: '100%',
                                height: 'auto',
                                width: 'auto',
                                objectFit: 'contain',
                            }}
                        />
                    </ReactCrop>
                </Box>

                <Grid container direction="row" alignItems="flex-start" justifyContent="flex-start" spacing={2}>
                    <Grid item xs={12}>
                        <MetDescription>{cropText}</MetDescription>
                    </Grid>
                    <Grid item xs={12} container justifyContent="flex-end" spacing={2}>
                        <If condition={saveAndExitRequired}>
                            <Then>
                                <Grid item>
                                    <SecondaryButton onClick={() => handleCropDone()} variant="contained">
                                        {saveAndExitText}
                                    </SecondaryButton>
                                </Grid>
                                <Grid item>
                                    <PrimaryButton
                                        onClick={async () => {
                                            const croppedImage = await handleCropDone();
                                            handleUploadImage(croppedImage);
                                        }}
                                        variant="outlined"
                                    >
                                        {saveText}
                                    </PrimaryButton>
                                </Grid>
                            </Then>
                            <Else>
                                <Grid item>
                                    <PrimaryButton onClick={() => handleCropDone()} variant="contained">
                                        {saveText}
                                    </PrimaryButton>
                                </Grid>
                            </Else>
                        </If>
                    </Grid>
                </Grid>
            </Paper>
        </Modal>
    );
};

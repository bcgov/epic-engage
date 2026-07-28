import React, { useContext } from 'react';
import { Grid, Stack, Typography, IconButton } from '@mui/material';
import Dropzone, { Accept, FileRejection } from 'react-dropzone';
import { MetWidgetPaper, WidgetButton } from 'components/shared/common';
import { FileUploadContext } from './FileUploadContext';
import LinkIcon from '@mui/icons-material/Link';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { useAppDispatch } from 'hooks';
import { openNotification } from 'services/notificationService/notificationSlice';

// Keep in sync with ShapefileService.MAX_ZIP_UPLOAD_SIZE on the backend.
export const MAX_SHAPEFILE_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

interface UploaderProps {
    acceptedFormat?: Accept;
}
const Uploader = ({ acceptedFormat = { 'application/zip': ['.zip'] } }: UploaderProps) => {
    const { handleAddFile, savedFileName, addedFileName, setAddedFileName } = useContext(FileUploadContext);
    const dispatch = useAppDispatch();

    const existingFile = addedFileName;

    const handleDropRejected = (fileRejections: FileRejection[]) => {
        const isTooLarge = fileRejections.some((rejection) =>
            rejection.errors.some((error) => error.code === 'file-too-large'),
        );
        const text = isTooLarge
            ? `File is too large. Maximum allowed size is ${Math.floor(
                  MAX_SHAPEFILE_UPLOAD_SIZE_BYTES / (1024 * 1024),
              )} MB.`
            : 'Unsupported file. Please upload a zipped shapefile (.zip).';
        dispatch(openNotification({ severity: 'error', text }));
    };

    if (existingFile) {
        return (
            <>
                <Dropzone
                    accept={acceptedFormat}
                    maxSize={MAX_SHAPEFILE_UPLOAD_SIZE_BYTES}
                    onDropRejected={handleDropRejected}
                    onDrop={async (acceptedFiles) => {
                        if (!acceptedFiles.length) {
                            setAddedFileName('');
                            return;
                        }

                        const uploadSucceeded = await handleAddFile(acceptedFiles);
                        setAddedFileName(uploadSucceeded ? acceptedFiles[0].name : '');
                    }}
                >
                    {({ getInputProps, open }) => (
                        <section>
                            <input {...getInputProps()} />
                            <WidgetButton onClick={open} sx={{ mb: 1 }}>
                                Upload Shapefile
                            </WidgetButton>
                        </section>
                    )}
                </Dropzone>
                <Grid container direction="row" alignItems="flex-start" justifyContent={'flex-start'} item xs={12}>
                    <MetWidgetPaper elevation={1} sx={{ width: '100%' }}>
                        <Grid container direction="row" alignItems={'center'} justifyContent="flex-start">
                            <Grid item xs>
                                <Stack spacing={2} direction="row" alignItems="center">
                                    <LinkIcon color="info" />
                                    <Typography>{addedFileName ? addedFileName : savedFileName}</Typography>
                                </Stack>
                            </Grid>
                            <IconButton
                                onClick={() => {
                                    setAddedFileName('');
                                    handleAddFile([]);
                                }}
                                sx={{ padding: 0, margin: 0 }}
                                color="inherit"
                                aria-label="Remove Shapefile"
                            >
                                <HighlightOffIcon />
                            </IconButton>
                        </Grid>
                    </MetWidgetPaper>
                </Grid>
            </>
        );
    }
    return (
        <Dropzone
            accept={acceptedFormat}
            maxSize={MAX_SHAPEFILE_UPLOAD_SIZE_BYTES}
            onDropRejected={handleDropRejected}
            onDrop={async (acceptedFiles) => {
                if (!acceptedFiles.length) {
                    setAddedFileName('');
                    return;
                }

                const uploadSucceeded = await handleAddFile(acceptedFiles);
                setAddedFileName(uploadSucceeded ? acceptedFiles[0].name : '');
            }}
        >
            {({ getInputProps, open }) => (
                <section>
                    <input {...getInputProps()} />
                    <WidgetButton onClick={open}>Upload Shapefile</WidgetButton>
                </section>
            )}
        </Dropzone>
    );
};

export default Uploader;

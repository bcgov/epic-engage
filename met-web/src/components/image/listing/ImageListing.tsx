import React, { useContext } from 'react';
import Grid from '@mui/material/Grid';
import { ImageContext } from './ImageContext';
import { HeaderTitle, MetPageGridContainer, MetParagraph, PrimaryButton } from 'components/common';
import ImageUpload from '../../imageUpload';
import { IconButton, Stack, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import MetTable from 'components/common/Table';
import { HeadCell, PaginationOptions } from 'components/common/Table/types';
import { ImageInfo } from 'models/image';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Else, If, Then } from 'react-if';
import { openNotification } from 'services/notificationService/notificationSlice';
import { useAppDispatch } from 'hooks';

const ImageListing = () => {
    const {
        images,
        handleUploadImage,
        paginationOptions,
        searchText,
        setSearchText,
        tableLoading,
        pageInfo,
        setPaginationOptions,
        imageToDisplay,
    } = useContext(ImageContext);

    const dispatch = useAppDispatch();

    const copyToClipBoard = (text: string) => {
        navigator.clipboard.writeText(text);
        dispatch(openNotification({ severity: 'success', text: 'URL copied to clipboard' }));
    };

    const headCells: HeadCell<ImageInfo>[] = [
        {
            key: 'display_name',
            label: '',
            disablePadding: true,
            allowSort: true,
            numeric: false,
            renderCell: (row: ImageInfo) => {
                return (
                    <img
                        src={row.url}
                        style={{
                            maxWidth: '100px',
                            maxHeight: '100px',
                            width: 'auto',
                            height: 'auto',
                        }}
                    />
                );
            },
        },
        {
            key: 'display_name',
            label: 'File Name',
            disablePadding: true,
            allowSort: true,
            numeric: false,
        },
        {
            key: 'date_uploaded',
            label: 'Date Uploaded',
            disablePadding: true,
            allowSort: true,
            numeric: false,
            renderCell: (row: ImageInfo) => {
                const date = new Date(row.date_uploaded);
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed, pad with leading zero
                const day = date.getDate().toString().padStart(2, '0'); // Pad with leading zero
                return (
                    <Grid container item>
                        {`${year}-${month}-${day}`}
                    </Grid>
                );
            },
        },
        {
            key: 'url',
            label: 'Image URL',
            disablePadding: true,
            allowSort: true,
            numeric: false,
            renderCell: (row: ImageInfo) => (
                <Grid container direction={'row'} gap={1} alignItems={'center'}>
                    <Grid item>{row.url}</Grid>
                    <Grid item>
                        <IconButton onClick={() => copyToClipBoard(row.url)}>
                            <ContentCopyIcon />
                        </IconButton>
                    </Grid>
                </Grid>
            ),
        },
    ];

    return (
        <MetPageGridContainer
            direction="row"
            justifyContent="flex-start"
            alignItems="flex-start"
            container
            columnSpacing={2}
            rowSpacing={2}
        >
            <Grid item xs={12}>
                <HeaderTitle>Image URL Generator</HeaderTitle>
            </Grid>
            <Grid item xs={12}>
                <ImageUpload
                    margin={4}
                    data-testid="image-listing/image-upload"
                    handleAddFile={handleUploadImage}
                    height={'240px'}
                    canCrop={false}
                />
            </Grid>
            <If condition={imageToDisplay != undefined}>
                <Then>
                    <Grid item xs={6}>
                        <Stack direction="row" spacing={2} alignItems="center" justifyContent="left">
                            <img
                                src={imageToDisplay?.url}
                                style={{
                                    maxWidth: '100px',
                                    maxHeight: '100px',
                                    width: 'auto',
                                    height: 'auto',
                                }}
                            />
                            <MetParagraph>{imageToDisplay?.display_name} has been successfully uploaded</MetParagraph>
                            <CheckCircleOutlineIcon color="success" />
                        </Stack>
                    </Grid>
                    <Grid item xs={6}>
                        <Stack
                            direction="row"
                            spacing={2}
                            alignItems="center"
                            justifyContent="right"
                            sx={{ height: 100 }}
                        >
                            <MetParagraph>{imageToDisplay?.url}</MetParagraph>
                            <IconButton onClick={() => copyToClipBoard(imageToDisplay?.url ?? '')}>
                                <ContentCopyIcon />
                            </IconButton>
                        </Stack>
                    </Grid>
                </Then>
                <Else>
                    <Grid item sx={{ height: '100px' }} />
                </Else>
            </If>

            <Grid item xs={12}>
                <HeaderTitle>Uploaded Files</HeaderTitle>
            </Grid>
            <Grid item xs={12}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                        id="engagement-name"
                        variant="outlined"
                        label="Search by name"
                        name="searchText"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        size="small"
                    />
                    <PrimaryButton onClick={() => setPaginationOptions({ page: 1, size: 10 })}>
                        <SearchIcon />
                    </PrimaryButton>
                </Stack>
            </Grid>
            <Grid item xs={12}>
                <MetTable
                    headCells={headCells}
                    rows={images}
                    handleChangePagination={(paginationOptions: PaginationOptions<ImageInfo>) =>
                        setPaginationOptions(paginationOptions)
                    }
                    paginationOptions={paginationOptions}
                    loading={tableLoading}
                    pageInfo={pageInfo}
                />
            </Grid>
        </MetPageGridContainer>
    );
};

export default ImageListing;

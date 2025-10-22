import React, { useContext } from 'react';
import Grid from '@mui/material/Grid';
import { ImageContext } from './ImageContext';
import { HeaderTitle, MetPageGridContainer, MetParagraph, PrimaryButton } from 'components/shared/common';
import ImageUpload from '../ImageUpload';
import { IconButton, Stack, TextField } from '@mui/material';
import { Search as SearchIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import MetTable from 'components/shared/common/Table';
import { HeadCell, PaginationOptions } from 'components/shared/common/Table/types';
import { ImageInfo } from 'models/image';
import { Else, If, Then, When } from 'react-if';
import { formatDate } from 'utils/helpers/dateHelper';
import { useAppSelector } from 'hooks';
import { USER_ROLES } from 'services/userService/constants';
import { ImageInfoActionsDropdown } from './ImageInfoActionsDropdown';

const ImageListing = () => {
    const {
        images,
        handleTempUpload,
        paginationOptions,
        searchText,
        setSearchText,
        tableLoading,
        pageInfo,
        setPaginationOptions,
        imageToDisplay,
        handleUploadImage,
        imageToUpload,
        archivedFilter,
        setArchivedFilter,
        fetchImages,
    } = useContext(ImageContext);

    const { roles } = useAppSelector((state) => state.user);

    const authorized = roles.includes(USER_ROLES.CREATE_IMAGES);

    const headCells: HeadCell<ImageInfo>[] = [
        {
            key: 'url',
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
                return (
                    <Grid container item>
                        {formatDate(row.date_uploaded)}
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
                        <IconButton
                            component="a"
                            href={imageToDisplay?.url ?? ''}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <OpenInNewIcon />
                        </IconButton>
                    </Grid>
                </Grid>
            ),
        },
        {
            key: 'id',
            numeric: true,
            disablePadding: false,
            label: 'Actions',
            allowSort: false,
            renderCell: (row: ImageInfo) => {
                return <ImageInfoActionsDropdown reload={() => fetchImages()} imageInfo={row} />;
            },
            customStyle: {
                minWidth: '200px',
            },
        },
    ];

    const resetPagination = () => {
        const prev = paginationOptions;
        setPaginationOptions({ ...prev, page: 1, size: 10 });
    };

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
                    handleAddFile={handleTempUpload}
                    height={'240px'}
                    cropText="You can zoom in or out and move the image around."
                />
            </Grid>
            <If condition={imageToUpload != null}>
                <Then>
                    <Grid item xs={12}>
                        <Stack direction={'row'} justifyContent={'flex-end'} alignItems={'center'}>
                            <PrimaryButton
                                onClick={() => {
                                    handleUploadImage();
                                }}
                                size="small"
                            >
                                Upload
                            </PrimaryButton>
                        </Stack>
                    </Grid>
                </Then>
            </If>
            <If condition={imageToDisplay?.url}>
                <Then>
                    <Grid item xs={6}>
                        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
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
                            <IconButton
                                component="a"
                                href={imageToDisplay?.url ?? ''}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <OpenInNewIcon />
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
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                resetPagination();
                            }
                        }}
                        size="small"
                    />
                    <PrimaryButton data-testid="image/listing/searchButton" onClick={resetPagination}>
                        <SearchIcon />
                    </PrimaryButton>
                </Stack>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    width="100%"
                    justifyContent="flex-end"
                    sx={{ p: 2 }}
                >
                    <When condition={authorized}>
                        <PrimaryButton
                            onClick={() => {
                                setPaginationOptions({
                                    page: 1,
                                    size: 10,
                                    sort_key: 'id',
                                    nested_sort_key: null,
                                    sort_order: 'asc',
                                });
                                setArchivedFilter(!archivedFilter);
                            }}
                        >
                            {archivedFilter ? 'View Images' : 'View Archive'}
                        </PrimaryButton>
                    </When>
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

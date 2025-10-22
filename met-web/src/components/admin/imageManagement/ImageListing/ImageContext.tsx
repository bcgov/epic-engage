import React, { createContext, useEffect, useState } from 'react';
import { ImageInfo } from 'models/image';
import { saveObject } from 'services/objectStorageService';
import { getImages, postImage } from 'services/imageService';
import { useLocation } from 'react-router-dom';
import { createDefaultPageInfo, PageInfo, PaginationOptions } from 'components/shared/common/Table/types';
import { updateURLWithPagination } from 'components/shared/common/Table/utils';
import { openNotification } from 'services/notificationService/notificationSlice';
import { useAppDispatch } from 'hooks';

export interface ImageListingContext {
    images: ImageInfo[];
    handleTempUpload: (_files: File[]) => void;
    handleUploadImage: () => void;
    searchText: string;
    setSearchText: (value: string) => void;
    paginationOptions: PaginationOptions<ImageInfo>;
    setPaginationOptions: (value: PaginationOptions<ImageInfo>) => void;
    pageInfo: PageInfo;
    setPageInfo: (value: PageInfo) => void;
    tableLoading: boolean;
    imageToDisplay: ImageInfo | undefined;
    imageToUpload: File | null;
    archivedFilter: boolean;
    setArchivedFilter: (value: boolean) => void;
    fetchImages: () => void;
}

export const ImageContext = createContext<ImageListingContext>({
    images: [],
    handleTempUpload: (_files: File[]) => {
        /* empty default method  */
    },
    handleUploadImage: () => {
        /* empty default method  */
    },
    searchText: '',
    setSearchText: () => {
        /* empty default method  */
    },
    paginationOptions: {
        page: 1,
        size: 10,
        sort_key: 'date_uploaded',
        sort_order: 'desc',
    },
    setPaginationOptions: () => {
        /* empty default method  */
    },
    pageInfo: createDefaultPageInfo(),
    setPageInfo: () => {
        /* empty default method  */
    },
    tableLoading: false,
    imageToDisplay: undefined,
    imageToUpload: null,
    archivedFilter: false,
    setArchivedFilter: () => {
        /* empty default method  */
    },
    fetchImages() {
        /* empty default method  */
    },
});

export const ImageProvider = ({ children }: { children: JSX.Element | JSX.Element[] }) => {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const pageFromURL = searchParams.get('page');
    const sizeFromURL = searchParams.get('size');
    const [paginationOptions, setPaginationOptions] = useState<PaginationOptions<ImageInfo>>({
        page: Number(pageFromURL) || 1,
        size: Number(sizeFromURL) || 10,
        sort_key: 'date_uploaded',
        sort_order: 'desc',
    });

    const [imageToDisplay, setImageToDisplay] = useState<ImageInfo>();
    const [searchText, setSearchText] = useState<string>('');
    const [tableLoading, setTableLoading] = useState(true);
    const [pageInfo, setPageInfo] = useState<PageInfo>(createDefaultPageInfo());
    const [images, setImages] = useState<Array<ImageInfo>>([]);
    const [imageToUpload, setImageToUpload] = useState<File | null>(null);
    const [archivedFilter, setArchivedFilter] = useState<boolean>(false);
    const dispatch = useAppDispatch();
    const { page, size, sort_key, sort_order } = paginationOptions;

    const handleTempUpload = async (files: File[]) => {
        if (files.length > 0) {
            setImageToDisplay(undefined);
            setImageToUpload(files[0]);
            return;
        }
        setImageToUpload(null);
    };

    const handleUploadImage = async () => {
        if (!imageToUpload) return;
        try {
            const [uniquefilename, fileName]: string[] = (await handleSaveImageToS3(imageToUpload)) || [];
            createImage(uniquefilename, fileName);
            setImageToUpload(null);
        } catch (error) {
            console.log(error);
        }
    };

    const handleSaveImageToS3 = async (file: File) => {
        if (!file) {
            return;
        }
        try {
            const savedDocumentDetails = await saveObject(file, { filename: file.name });
            return [savedDocumentDetails?.uniquefilename, savedDocumentDetails?.filename];
        } catch (error) {
            console.log(error);
            throw new Error('Error occurred during image upload');
        }
    };

    const createImage = async (uniqueFilename: string, fileName: string) => {
        setImageToDisplay(undefined);
        const date_uploaded = new Date();
        try {
            const image: ImageInfo = await postImage({
                unique_name: uniqueFilename,
                display_name: fileName,
                date_uploaded,
            });
            setPaginationOptions({ page: 1, size: 10 });
            setImageToDisplay(image);
        } catch (err) {
            dispatch(openNotification({ severity: 'error', text: 'Error occurred while creating image' }));
        }
    };

    const fetchImages = async () => {
        try {
            setTableLoading(true);
            const response = await getImages({
                page,
                size,
                sort_key,
                sort_order,
                search_text: searchText,
                archived: archivedFilter,
            });
            setImages(response.items);
            setPageInfo({
                total: response.total,
            });
            setTableLoading(false);
        } catch (err) {
            dispatch(openNotification({ severity: 'error', text: 'Error occurred while fetching images' }));
            setTableLoading(false);
        }
    };

    useEffect(() => {
        updateURLWithPagination(paginationOptions);
        fetchImages();
    }, [paginationOptions]);

    return (
        <ImageContext.Provider
            value={{
                images,
                handleTempUpload,
                searchText,
                setSearchText,
                paginationOptions,
                setPaginationOptions,
                tableLoading,
                pageInfo,
                setPageInfo,
                imageToDisplay,
                imageToUpload,
                handleUploadImage,
                archivedFilter,
                setArchivedFilter,
                fetchImages,
            }}
        >
            {children}
        </ImageContext.Provider>
    );
};

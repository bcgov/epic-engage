import React, { createContext, useEffect, useState } from 'react';
import { ImageInfo } from 'models/image';
import { saveObject } from 'services/objectStorageService';
import { getImages, postImage } from 'services/imageService';
import { useLocation } from 'react-router-dom';
import { createDefaultPageInfo, PageInfo, PaginationOptions } from 'components/common/Table/types';
import { updateURLWithPagination } from 'components/common/Table/utils';
import { openNotification } from 'services/notificationService/notificationSlice';
import { useAppDispatch } from 'hooks';

export interface ImageListingContext {
    images: ImageInfo[];
    handleUploadImage: (_files: File[]) => void;
    searchText: string;
    setSearchText: (value: string) => void;
    paginationOptions: PaginationOptions<ImageInfo>;
    setPaginationOptions: (value: PaginationOptions<ImageInfo>) => void;
    pageInfo: PageInfo;
    setPageInfo: (value: PageInfo) => void;
    tableLoading: boolean;
    imageToDisplay: ImageInfo | undefined;
}

export const ImageContext = createContext<ImageListingContext>({
    images: [],
    handleUploadImage: (_files: File[]) => {
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
    const dispatch = useAppDispatch();
    const { page, size, sort_key, sort_order } = paginationOptions;

    const handleUploadImage = async (files: File[]) => {
        if (files.length > 0) {
            const [uniquefilename, fileName]: string[] = (await handleSaveImage(files[0])) || [];
            createImage(uniquefilename, fileName);
        }
    };

    const handleSaveImage = async (file: File) => {
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

    const fetchImages = async () => {
        try {
            setTableLoading(true);
            const response = await getImages({
                page,
                size,
                sort_key,
                sort_order,
                search_text: searchText,
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

    const createImage = async (unqiueFilename: string, fileName: string) => {
        setImageToDisplay(undefined);
        const date_uploaded = new Date();
        try {
            const image: ImageInfo = await postImage({
                unique_name: unqiueFilename,
                display_name: fileName,
                date_uploaded,
            });
            setPaginationOptions({ page: 1, size: 10 });
            setImageToDisplay(image);
        } catch (err) {
            dispatch(openNotification({ severity: 'error', text: 'Error occurred while creating image' }));
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
                handleUploadImage,
                searchText,
                setSearchText,
                paginationOptions,
                setPaginationOptions,
                tableLoading,
                pageInfo,
                setPageInfo,
                imageToDisplay,
            }}
        >
            {children}
        </ImageContext.Provider>
    );
};

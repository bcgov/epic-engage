import http from 'apiManager/httpRequestHandler';
import { Page } from 'services/type';
import { ImageInfo } from 'models/image';
import Endpoints from 'apiManager/endpoints';
import { replaceUrl } from 'utils/helpers';

interface GetImageParams {
    page?: number;
    size?: number;
    sort_key?: string;
    sort_order?: 'asc' | 'desc';
    search_text?: string;
    archived?: boolean;
}

interface PostImageParams {
    unique_name: string;
    display_name: string;
    date_uploaded: Date;
}

export const getImages = async (params: GetImageParams = {}): Promise<Page<ImageInfo>> => {
    const responseData = await http.GetRequest<Page<ImageInfo>>(Endpoints.Images.GET, params);
    return (
        responseData.data ?? {
            items: [],
            total: 0,
        }
    );
};

export const postImage = async (data: PostImageParams): Promise<ImageInfo> => {
    const response = await http.PostRequest<ImageInfo>(Endpoints.Images.CREATE, data);
    if (response.data) {
        return response.data;
    }
    return Promise.reject('Failed to create image');
};

export const updateImage = async (imageInfoId: number, data: Partial<ImageInfo>): Promise<ImageInfo> => {
    const url = replaceUrl(Endpoints.Images.UPDATE, 'image_id', String(imageInfoId));
    const response = await http.PatchRequest<ImageInfo>(url, data);
    if (response.data) {
        return response.data;
    }
    return Promise.reject('Failed to update image');
};

export const deleteImage = async (imageInfoId: number): Promise<void> => {
    const url = replaceUrl(Endpoints.Images.DELETE, 'image_id', String(imageInfoId));
    const response = await http.DeleteRequest(url);
    if (response.status !== 200) {
        return Promise.reject('Failed to delete image');
    }
};

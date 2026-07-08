import http from 'apiManager/httpRequestHandler';
import { Comment, GroupedComment } from 'models/comment';
import Endpoints from 'apiManager/endpoints';

import { replaceUrl } from 'utils/helpers';
import { Page } from 'services/type';

interface GetCommentsParams {
    survey_id: number;
    page?: number;
    size?: number;
    sort_key?: string;
    sort_order?: 'asc' | 'desc';
    search_text?: string;
}
export const getCommentsPage = async ({
    survey_id,
    page,
    size,
    sort_key,
    sort_order,
    search_text,
}: GetCommentsParams): Promise<Page<Comment>> => {
    const url = replaceUrl(Endpoints.Comment.GET_LIST, 'survey_id', String(survey_id));
    const responseData = await http.GetRequest<Page<Comment>>(url, { page, size, sort_key, sort_order, search_text });
    return (
        responseData.data ?? {
            items: [],
            total: 0,
        }
    );
};

interface GetGroupedCommentsParams {
    survey_id: number;
}
export const getGroupedComments = async ({ survey_id }: GetGroupedCommentsParams): Promise<GroupedComment[]> => {
    const url = replaceUrl(Endpoints.Comment.GET_GROUPED, 'survey_id', String(survey_id));
    const responseData = await http.GetRequest<GroupedComment[]>(url);
    return responseData.data ?? [];
};

interface GenerateCommentsSheetParams {
    survey_id: number;
}
export const getStaffCommentSheet = async ({ survey_id }: GenerateCommentsSheetParams) => {
    const url = replaceUrl(Endpoints.Comment.GET_STAFF_SPREAD_SHEET, 'survey_id', String(survey_id));
    return http.GetRequest<Blob>(url, {}, {}, 'arraybuffer');
};

export const getProponentCommentSheet = async ({ survey_id }: GenerateCommentsSheetParams) => {
    const url = replaceUrl(Endpoints.Comment.GET_PROPONENT_SPREAD_SHEET, 'survey_id', String(survey_id));
    const responseType = 'arraybuffer';
    const headers = {
        'Content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return http.GetRequest<Blob>(url, {}, headers, responseType);
};

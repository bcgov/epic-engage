import axios, { AxiosRequestConfig } from 'axios';
import UserService from 'services/userService';

/**
 * Get the analytics session ID for server-side event tracking.
 * This enables the backend to send events with the same sessionId as frontend events.
 */
const getAnalyticsSessionId = (): string => {
    return sessionStorage.getItem('penguin_session_id') || '';
};

/**
 * Get default headers for authenticated API requests.
 */
const getDefaultHeaders = (): Record<string, string> => ({
    'Content-type': 'application/json',
    Authorization: `Bearer ${UserService.getToken()}`,
    'tenant-id': `${sessionStorage.getItem('tenantId')}`,
    'X-Analytics-Session-Id': getAnalyticsSessionId(),
});

const GetRequest = <T>(url: string, params = {}, headers = {}, responseType?: string) => {
    const requestOptions: AxiosRequestConfig = {
        params,
        headers: { ...getDefaultHeaders(), ...headers },
    };

    if (responseType) {
        requestOptions.responseType = responseType as AxiosRequestConfig['responseType'];
    }

    return axios.get<T>(url, requestOptions);
};

const PostRequest = <T>(url: string, data = {}, params = {}) => {
    const headers = getDefaultHeaders();
    if (data instanceof FormData) {
        delete headers['Content-type'];
    }

    return axios.post<T>(url, data, { params, headers });
};

const PutRequest = <T>(url: string, data = {}, params = {}) => {
    const headers = getDefaultHeaders();
    if (data instanceof FormData) {
        delete headers['Content-type'];
    }

    return axios.put<T>(url, data, { params, headers });
};

const PatchRequest = <T>(url: string, data = {}) => {
    const headers = getDefaultHeaders();
    if (data instanceof FormData) {
        delete headers['Content-type'];
    }

    return axios.patch<T>(url, data, { headers });
};

const DeleteRequest = <T>(url: string, params = {}) => {
    return axios.delete<T>(url, { params, headers: getDefaultHeaders() });
};

interface OSSRequestOptions {
    amzDate: string;
    authHeader: string;
}
export const OSSGetRequest = <T>(url: string, requestOptions: OSSRequestOptions) => {
    return axios.get<T>(url, {
        headers: {
            'X-Amz-Date': requestOptions.amzDate,
            Authorization: requestOptions.authHeader,
            'tenant-id': `${sessionStorage.getItem('tenantId')}`,
        },
        responseType: 'blob',
    });
};

export const OSSPutRequest = <T>(url: string, data: File, requestOptions: OSSRequestOptions) => {
    return axios.put<T>(url, data, {
        headers: {
            'X-Amz-Date': requestOptions.amzDate,
            Authorization: requestOptions.authHeader,
            'tenant-id': `${sessionStorage.getItem('tenantId')}`,
        },
    });
};
export default {
    GetRequest,
    PostRequest,
    PutRequest,
    PatchRequest,
    DeleteRequest,
    OSSGetRequest,
    OSSPutRequest,
};

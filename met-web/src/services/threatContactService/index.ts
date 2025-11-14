import Endpoints from 'apiManager/endpoints';
import { ThreatContact } from 'models/threatContact';
import http from 'apiManager/httpRequestHandler';

interface PostThreatContactRequest {
    first_name?: string;
    last_name?: string;
    email?: string;
}

export const getThreatContactById = async (id: number): Promise<ThreatContact> => {
    try {
        const response = await http.GetRequest<ThreatContact>(
            `${Endpoints.ThreatContacts.GET.replace('threat_contact_id', id.toString())}`,
        );
        return response.data;
    } catch (err) {
        return Promise.reject(err);
    }
};

export const getThreatContacts = async (): Promise<ThreatContact[]> => {
    try {
        const response = await http.GetRequest<ThreatContact[]>(Endpoints.ThreatContacts.GET_LIST);
        return response.data;
    } catch (err) {
        return Promise.reject(err);
    }
};

export const postThreatContact = async (data: PostThreatContactRequest): Promise<ThreatContact> => {
    try {
        const response = await http.PostRequest<ThreatContact>(Endpoints.ThreatContacts.CREATE, data);
        return response.data;
    } catch (err) {
        return Promise.reject(err);
    }
};

import http from 'apiManager/httpRequestHandler';
import Endpoints from 'apiManager/endpoints';
import { Setting } from 'models/settings';

export const getSettings = async (): Promise<Setting[]> => {
    try {
        const response = await http.GetRequest<Setting[]>(Endpoints.Settings.GET);
        if (response.data) {
            return response.data;
        }
        return Promise.reject('Failed to fetch settings');
    } catch (err) {
        return Promise.reject(err);
    }
};

export const getSettingByKey = async (settingKey: string): Promise<Setting | null> => {
    try {
        const response = await http.GetRequest<Setting>(
            Endpoints.Settings.GET_BY_KEY.replace(':setting_key', settingKey),
        );
        if (response.data) {
            return response.data;
        }
        return null;
    } catch (err) {
        return Promise.reject(err);
    }
};

type SettingPostPayload = {
    setting_key: string;
    setting_value: string;
    setting_value_type: string;
};

export const postSettings = async (settings: SettingPostPayload): Promise<Setting> => {
    try {
        const response = await http.PostRequest<Setting>(Endpoints.Settings.CREATE, settings);
        if (response.data) {
            return response.data;
        }
        return Promise.reject('Failed to post settings');
    } catch (err) {
        return Promise.reject(err);
    }
};

export const patchSettings = async (id: string, setting_value: string): Promise<Setting> => {
    try {
        const response = await http.PatchRequest<Setting>(Endpoints.Settings.UPDATE.replace(':id', id), {
            setting_value,
        });
        if (response.data) {
            return response.data;
        }
        return Promise.reject('Failed to patch settings');
    } catch (err) {
        return Promise.reject(err);
    }
};

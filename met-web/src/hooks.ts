import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './redux/store';
import { useTranslation } from 'react-i18next';
import { AppConfig } from 'config';
import { useEffect } from 'react';
import { recordAnalytics } from '@epic/centre-analytics';

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export const useAppTranslation = () => {
    const translate = useTranslation();
    const tenantId = sessionStorage.getItem('tenantId') || AppConfig.tenant.defaultTenant;

    const { t } = translate;

    const tDynamic = (key: string) => {
        // Create a dynamic translation key using the tenantId
        const dynamicKey = `${tenantId}:${key}`;
        return t(dynamicKey);
    };

    return { ...translate, t: tDynamic };
};

export const useRecordAnalyticsWithRetry = (maxRetries = 3, delay = 5000) => {
    const bearerToken = useAppSelector((state) => state.user?.bearerToken);
    const userDetail = useAppSelector((state) => state.user?.userDetail);
    const isLoggedIn = useAppSelector((state) => state.user.authentication.authenticated);

    useEffect(() => {
        if (!AppConfig.centreApiUrl || !isLoggedIn || !bearerToken || !userDetail) return;

        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        const retry = async (fn: () => Promise<void>, retries = maxRetries, retryDelay = delay) => {
            let lastError;
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    return await fn();
                } catch (error) {
                    lastError = error;
                    if (attempt < retries) {
                        await wait(retryDelay);
                    }
                }
            }
            throw lastError;
        };

        const record = async () => {
            await retry(() =>
                recordAnalytics({
                    appName: 'epic_engage',
                    centreApiUrl: AppConfig.centreApiUrl,
                    enabled: true,
                    authState: {
                        user: {
                            access_token: bearerToken,
                            profile: {
                                preferred_username: userDetail.preferred_username,
                                sub: userDetail.sub,
                            },
                        },
                        isAuthenticated: true,
                    },
                }),
            );
        };

        record().catch((error) => {
            console.log('Failed to record analytics after retries:', error);
        });
    }, [isLoggedIn, bearerToken, userDetail, AppConfig, recordAnalytics, maxRetries, delay]);
};

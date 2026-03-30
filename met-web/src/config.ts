import { ITenantDetail } from 'constants/types';

declare global {
    interface Window {
        _env_: {
            VITE_API_URL: string;
            VITE_PUBLIC_URL: string;
            VITE_REDASH_PUBLIC_URL: string;
            VITE_REDASH_COMMENTS_PUBLIC_URL: string;

            // Analytics
            VITE_ANALYTICS_API_URL: string;

            // Penguin Analytics (event tracking)
            VITE_PENGUIN_URL: string;
            VITE_PENGUIN_ENABLED: string;

            // Formio
            VITE_API_PROJECT_URL: string;
            VITE_FORM_ID: string;
            VITE_FORMIO_JWT_SECRET: string;
            VITE_USER_RESOURCE_FORM_ID: string;
            VITE_FORMIO_ANONYMOUS_USER: string;
            VITE_ANONYMOUS_ID: string;

            // Keycloak
            VITE_KEYCLOAK_URL: string;
            VITE_KEYCLOAK_CLIENT: string;
            VITE_KEYCLOAK_REALM: string;
            VITE_KEYCLOAK_ADMIN_ROLE: string;

            // Constants
            VITE_ENGAGEMENT_PROJECT_TYPES: string;

            //tenant
            VITE_IS_SINGLE_TENANT_ENVIRONMENT: string;
            VITE_DEFAULT_TENANT: string;

            [key: string]: string;
        };
    }
}

export const getEnv = (key: string, defaultValue = ''): string => {
    if (typeof window !== 'undefined' && window._env_ && window._env_[key] !== undefined) {
        return window._env_[key];
    }
    // For Jest and Node environments, use process.env
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key] as string;
    }
    return defaultValue;
};

// adding localStorage to access the MET API from external sources(eg: web-components)
const API_URL = localStorage.getItem('met-api-url') || getEnv('VITE_API_URL');
const PUBLIC_URL = localStorage.getItem('met-public-url') || getEnv('VITE_PUBLIC_URL');
const REDASH_DASHBOARD_URL = getEnv('VITE_REDASH_PUBLIC_URL');
const REDASH_CMNTS_DASHBOARD_URL = getEnv('VITE_REDASH_COMMENTS_PUBLIC_URL');
const CENTRE_API_URL = getEnv('VITE_CENTRE_API_URL');

// adding localStorage to access the MET Analytics API from external sources(eg: web-components)
const ANALYTICS_API_URL = localStorage.getItem('analytics-api-url') || getEnv('VITE_ANALYTICS_API_URL');

// Penguin Analytics (event tracking)
const PENGUIN_ANALYTICS_URL = getEnv('VITE_PENGUIN_URL', '/analytics');
const PENGUIN_ENABLED = getEnv('VITE_PENGUIN_ENABLED', 'false') === 'true';

// Formio Environment Variables
const FORMIO_PROJECT_URL = getEnv('VITE_API_PROJECT_URL');
const FORMIO_API_URL = getEnv('VITE_API_PROJECT_URL');
const FORMIO_FORM_ID = getEnv('VITE_FORM_ID');
const FORMIO_JWT_SECRET = getEnv('VITE_FORMIO_JWT_SECRET');
const FORMIO_USER_RESOURCE_FORM_ID = getEnv('VITE_USER_RESOURCE_FORM_ID');
const FORMIO_ANONYMOUS_USER = getEnv('VITE_FORMIO_ANONYMOUS_USER');
const FORMIO_ANONYMOUS_ID = getEnv('VITE_ANONYMOUS_ID');

// Keycloak Environment Variables
const KC_URL = getEnv('VITE_KEYCLOAK_URL');
const KC_CLIENT = getEnv('VITE_KEYCLOAK_CLIENT');
const KC_REALM = getEnv('VITE_KEYCLOAK_REALM');
const KC_ADMIN_ROLE = getEnv('VITE_KEYCLOAK_ADMIN_ROLE');

// App constants
const ENGAGEMENT_PROJECT_TYPES: string[] = getEnv(
    'VITE_ENGAGEMENT_PROJECT_TYPES',
    'Energy-Electricity,Energy - Petroleum & Natural Gas,' +
        'Food Processing,' +
        'Industrial,' +
        'Mines,' +
        'Other,' +
        'Tourist Destination Resorts,' +
        'Transportation,' +
        'Waste Disposal,' +
        'Water Management',
).split(',');

// tenant config
const IS_SINGLE_TENANT_ENVIRONMENT = getEnv('VITE_IS_SINGLE_TENANT_ENVIRONMENT', 'true') === 'true';
const DEFAULT_TENANT = getEnv('VITE_DEFAULT_TENANT');

export const AppConfig = {
    apiUrl: API_URL,
    analyticsApiUrl: ANALYTICS_API_URL,
    publicUrl: PUBLIC_URL,
    redashDashboardUrl: REDASH_DASHBOARD_URL,
    redashCmntsDashboardUrl: REDASH_CMNTS_DASHBOARD_URL,
    centreApiUrl: CENTRE_API_URL,
    penguinUrl: PENGUIN_ANALYTICS_URL,
    penguinEnabled: PENGUIN_ENABLED,
    formio: {
        projectUrl: FORMIO_PROJECT_URL,
        apiUrl: FORMIO_API_URL,
        formId: FORMIO_FORM_ID,
        anonymousId: FORMIO_ANONYMOUS_ID || '',
        anonymousUser: FORMIO_ANONYMOUS_USER || 'anonymous',
        userResourceFormId: FORMIO_USER_RESOURCE_FORM_ID,
        // TODO: potentially sensitive information, should be stored somewhere else?
        jwtSecret: FORMIO_JWT_SECRET || '',
    },
    keycloak: {
        url: KC_URL || '',
        clientId: KC_CLIENT || '',
        realm: KC_REALM || '',
        adminRole: KC_ADMIN_ROLE || 'admin',
    },
    constants: {
        engagementProjectTypes: ENGAGEMENT_PROJECT_TYPES,
    },
    tenant: {
        isSingleTenantEnvironment: IS_SINGLE_TENANT_ENVIRONMENT,
        defaultTenant: DEFAULT_TENANT,
    },
};

export const getTenantDetail = (): ITenantDetail => ({
    realm: getEnv('VITE_KEYCLOAK_REALM'),
    url: getEnv('VITE_KEYCLOAK_URL'),
    clientId: getEnv('VITE_KEYCLOAK_CLIENT'),
});

/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_KEYCLOAK_CLIENT: string;
    readonly VITE_KEYCLOAK_REALM: string;
    readonly VITE_KEYCLOAK_URL: string;
    readonly VITE_KEYCLOAK_ADMIN_ROLE: string;
    readonly VITE_API_URL: string;
    readonly VITE_ANALYTICS_API_URL: string;
    readonly VITE_REDASH_PUBLIC_URL: string;
    readonly VITE_REDASH_COMMENTS_PUBLIC_URL: string;
    readonly VITE_CENTRE_API_URL: string;
    readonly VITE_PENGUIN_URL: string;
    readonly VITE_PENGUIN_ENABLED: string;
    readonly VITE_API_PROJECT_URL: string;
    readonly VITE_FORM_ID: string;
    readonly VITE_FORMIO_JWT_SECRET: string;
    readonly VITE_USER_RESOURCE_FORM_ID: string;
    readonly VITE_FORMIO_ANONYMOUS_USER: string;
    readonly VITE_ANONYMOUS_ID: string;
    readonly VITE_DEFAULT_TENANT: string;
    readonly VITE_IS_SINGLE_TENANT_ENVIRONMENT: string;
    readonly VITE_ENGAGEMENT_PROJECT_TYPES: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

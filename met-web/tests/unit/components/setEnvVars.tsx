export function setupEnv() {
    // Jest uses process.env, but we use VITE_* naming for consistency
    process.env.VITE_KEYCLOAK_CLIENT = 'met-web';
    process.env.VITE_KEYCLOAK_REALM = 'met';
    process.env.VITE_KEYCLOAK_URL = 'https://dev.loginproxy.gov.bc.ca/auth';
    process.env.VITE_API_URL = 'http://127.0.0.1:5000/api';
}

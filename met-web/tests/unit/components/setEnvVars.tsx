export function setupEnv() {
    process.env.REACT_APP_KEYCLOAK_CLIENT = 'met-web';
    process.env.REACT_APP_KEYCLOAK_REALM = 'met';
    process.env.REACT_APP_KEYCLOAK_URL = 'https://dev.loginproxy.gov.bc.ca/auth';
    process.env.REACT_APP_API_URL = 'http://127.0.0.1:5000/api';
}

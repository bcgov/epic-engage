import { getTenantDetail } from 'config';
import Keycloak from 'keycloak-js';

export const _kc = new Keycloak(getTenantDetail());

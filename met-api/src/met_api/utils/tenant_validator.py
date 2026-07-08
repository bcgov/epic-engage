# Copyright © 2019 Province of British Columbia
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Roles validator decorator.

A simple decorator to validate roles with in the tenant.
"""
from functools import wraps
from http import HTTPStatus
from typing import Dict

from flask import abort, current_app, g

from met_api.auth import jwt as _jwt
from met_api.utils.constants import TENANT_ID_JWT_CLAIM
from met_api.utils.roles import Role


def require_role(role, skip_tenant_check_for_admin=False):
    """Validate a token for roles and against tenant as well.

    Args:
        role (str): The role that the user is required to have.
        skip_tenant_check_for_admin (bool, optional): A flag to indicate whether to skip tenant checks for MET Admins.
            If set to True, tenant checks are skipped for users with MET administrative privileges.
            Defaults to False. Set it to True for cross tenant operations like first time adding a super user to tenant.
    Returns:
        function: A decorator function that can be used to enforce role-based authorization.
    """
    def decorator(func):
        @wraps(func)
        @_jwt.has_one_of_roles(role)
        def wrapper(*args, **kwargs):
            # single tenanted env doesn't need tenant id checks..so pass
            if current_app.config.get('IS_SINGLE_TENANT_ENVIRONMENT'):
                return func(*args, **kwargs)

            # Get the tenant information from the JWT payload or any global context
            token_info: Dict = _get_token_info() or {}

            if skip_tenant_check_for_admin and is_met_global_admin(token_info):
                return func(*args, **kwargs)

            tenant_id = token_info.get(TENANT_ID_JWT_CLAIM, None)
            current_app.logger.debug(f'Tenant Id From JWT Claim {tenant_id}')

            g_tenant_id = getattr(g, 'tenant_id', None)
            current_app.logger.debug(f'Tenant Id From g {g_tenant_id}')

            # If g.tenant_id is not set but we have it in the token, set it
            if g_tenant_id is None and tenant_id is not None:
                g.tenant_id = tenant_id
                g_tenant_id = tenant_id

            if g_tenant_id and str(g_tenant_id) == str(tenant_id):
                return func(*args, **kwargs)
            else:
                abort(HTTPStatus.FORBIDDEN,
                      description='The user has no access to this tenant')
        return wrapper
    return decorator


def get_authorized_tenant_id():
    """Return the tenant id the current request is authorized to act within."""
    header_tenant_id = getattr(g, 'tenant_id', None)

    # Single-tenant deployments don't isolate data by tenant.
    if current_app.config.get('IS_SINGLE_TENANT_ENVIRONMENT'):
        return header_tenant_id

    token_info: Dict = _get_token_info() or {}

    # Anonymous request (no token) or global admin: trust the header.
    if not token_info or is_met_global_admin(token_info):
        return header_tenant_id

    claim_tenant_id = token_info.get(TENANT_ID_JWT_CLAIM, None)

    # An authenticated caller may not point a tenant header at another tenant.
    if claim_tenant_id is not None and header_tenant_id is not None \
            and str(header_tenant_id) != str(claim_tenant_id):
        current_app.logger.debug(
            f'Aborting. Tenant header/claim mismatch. '
            f'header: {header_tenant_id} claim: {claim_tenant_id}')
        abort(HTTPStatus.FORBIDDEN, description='The user has no access to this tenant')

    return claim_tenant_id if claim_tenant_id is not None else header_tenant_id


def _get_token_info() -> Dict:
    return g.jwt_oidc_token_info if g and 'jwt_oidc_token_info' in g else {}


def is_met_global_admin(token_info) -> bool:
    """Return True if the user is MET Admin ie who can manage all tenants."""
    roles: list = token_info.get('realm_access', None).get('roles', []) if 'realm_access' in token_info \
        else []
    return Role.CREATE_TENANT.value in roles

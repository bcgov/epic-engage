"""Helper for token decoding."""
from flask import current_app, g

from met_api.utils.enums import KeycloakGroupName
from met_api.utils.roles import Role
from met_api.utils.user_context import UserContext, user_context


# The Keycloak group path carried in the token's groups claim; the web app checks the same one.
SUPERUSER_GROUP = f'/ENGAGE/{KeycloakGroupName.EAO_IT_ADMIN.value}'


class TokenInfo:
    """Token info."""

    @staticmethod
    @user_context
    def get_id(**kwargs):
        """Get the user identifier."""
        try:
            user_from_context: UserContext = kwargs['user_context']
            return user_from_context.sub
        except AttributeError:
            return None

    @staticmethod
    def get_user_data():
        """Get the user data."""
        token_info = g.jwt_oidc_token_info
        user_data = {
            'external_id': token_info.get('sub', None),
            'first_name': token_info.get('given_name', None),
            'last_name': token_info.get('family_name', None),
            'email_address': token_info.get('email', None),
            'username': token_info.get('preferred_username', None),
            'identity_provider': token_info.get('identity_provider', ''),
            'roles': TokenInfo.get_user_roles(),
        }
        return user_data

    @staticmethod
    def get_user_roles():
        """Get the user roles from token."""
        if not hasattr(g, 'jwt_oidc_token_info') or not g.jwt_oidc_token_info:
            return []
        valid_roles = set(item.value for item in Role)
        token_roles = current_app.config['JWT_ROLE_CALLBACK'](g.jwt_oidc_token_info)
        return valid_roles.intersection(token_roles)

    @staticmethod
    def is_superuser() -> bool:
        """Check whether the token belongs to a member of the Superuser group."""
        token_info = getattr(g, 'jwt_oidc_token_info', None) or {}
        return SUPERUSER_GROUP in (token_info.get('groups') or [])

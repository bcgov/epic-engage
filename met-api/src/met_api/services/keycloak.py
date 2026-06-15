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
"""Utils for keycloak administration."""

import json
from concurrent.futures import ThreadPoolExecutor
from typing import List

from flask import current_app
import requests

from met_api.utils.cache import cache
from met_api.utils.enums import ContentType


class KeycloakService:  # pylint: disable=too-few-public-methods
    """Keycloak services."""

    @staticmethod
    def get_user_groups(user_id):
        """Get user group from Keycloak by userid."""
        base_url = current_app.config.get('KEYCLOAK_BASE_URL')
        realm = current_app.config.get('KEYCLOAK_REALMNAME')
        timeout = current_app.config.get('CONNECT_TIMEOUT', 60)
        admin_token = KeycloakService._get_admin_token()
        headers = {
            'Content-Type': ContentType.JSON.value,
            'Authorization': f'Bearer {admin_token}'
        }

        # Get the user and return
        query_user_url = f'{base_url}/auth/admin/realms/{realm}/users/{user_id}/groups'
        response = requests.get(query_user_url, headers=headers, timeout=timeout)
        response.raise_for_status()
        return response.json()

    @staticmethod
    def get_users_groups(user_ids: List):
        """Get user groups from Keycloak. Fetches per-group member lists (O(groups) vs O(users))."""
        base_url = current_app.config.get('KEYCLOAK_BASE_URL')
        if not base_url:
            return {}
        realm = current_app.config.get('KEYCLOAK_REALMNAME')
        timeout = current_app.config.get('CONNECT_TIMEOUT', 60)
        admin_token = KeycloakService._get_admin_token()
        headers = {
            'Content-Type': ContentType.JSON.value,
            'Authorization': f'Bearer {admin_token}'
        }

        groups_response = requests.get(
            f'{base_url}/auth/admin/realms/{realm}/groups',
            params={'max': 1000},
            headers=headers,
            timeout=timeout,
        )
        if groups_response.status_code != 200:
            return {}

        user_ids_set = set(user_ids)
        all_groups = list(KeycloakService._flatten_groups(groups_response.json()))

        def _fetch_members(group_id_name):
            gid, gname = group_id_name
            resp = requests.get(
                f'{base_url}/auth/admin/realms/{realm}/groups/{gid}/members',
                params={'max': 1000},
                headers=headers,
                timeout=timeout,
            )
            return gname, resp.json() if resp.status_code == 200 else []

        user_group_mapping = {}
        with ThreadPoolExecutor() as executor:
            for group_name, members in executor.map(_fetch_members, all_groups):
                for member in members:
                    member_id = member.get('id')
                    if member_id in user_ids_set:
                        user_group_mapping.setdefault(member_id, []).append(group_name)

        return user_group_mapping

    @staticmethod
    def _flatten_groups(groups):
        """Yield (id, name) for every group and subgroup in the Keycloak group hierarchy."""
        for group in groups:
            yield group['id'], group['name']
            if group.get('subGroups'):
                yield from KeycloakService._flatten_groups(group['subGroups'])

    @staticmethod
    def _get_group_id(admin_token: str, group_name: str):
        """Get a group id for the group name."""
        config = current_app.config
        base_url = config.get('KEYCLOAK_BASE_URL')
        realm = config.get('KEYCLOAK_REALMNAME')
        timeout = config.get('CONNECT_TIMEOUT', 60)
        get_group_url = f'{base_url}/auth/admin/realms/{realm}/groups?search={group_name}'
        headers = {
            'Content-Type': ContentType.JSON.value,
            'Authorization': f'Bearer {admin_token}'
        }
        response = requests.get(get_group_url, headers=headers, timeout=timeout)
        return KeycloakService._find_group_or_subgroup_id(response.json(), group_name)

    @staticmethod
    def _find_group_or_subgroup_id(groups: list, group_name: str):
        """Return group id by searching main and sub groups."""
        for group in groups:
            if group['name'] == group_name:
                return group['id']
            if group_id := KeycloakService._find_group_or_subgroup_id(group['subGroups'], group_name):
                return group_id
        return None

    @staticmethod
    def _get_admin_token():
        """Return a cached admin token, refreshing when it nears expiry."""
        cached = cache.get('keycloak_admin_token')
        if cached:
            return cached

        config = current_app.config
        base_url = config.get('KEYCLOAK_BASE_URL')
        realm = config.get('KEYCLOAK_REALMNAME')
        admin_client_id = config.get('KEYCLOAK_ADMIN_USERNAME')
        admin_secret = config.get('KEYCLOAK_ADMIN_SECRET')
        timeout = config.get('CONNECT_TIMEOUT', 60)
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        token_url = f'{base_url}/auth/realms/{realm}/protocol/openid-connect/token'

        response = requests.post(token_url,
                                 data=f'client_id={admin_client_id}&grant_type=client_credentials'
                                 f'&client_secret={admin_secret}', headers=headers,
                                 timeout=timeout)
        token = response.json().get('access_token')
        # Cache for 55 s — Keycloak client-credentials tokens typically live 60 s
        cache.set('keycloak_admin_token', token, timeout=55)
        return token

    @staticmethod
    def _remove_user_from_group(user_id: str, group_name: str):
        """Remove user from the keycloak group."""
        config = current_app.config
        base_url = config.get('KEYCLOAK_BASE_URL')
        realm = config.get('KEYCLOAK_REALMNAME')
        timeout = config.get('CONNECT_TIMEOUT', 60)
        # Create an admin token
        admin_token = KeycloakService._get_admin_token()
        # Get the '$group_name' group
        group_id = KeycloakService._get_group_id(admin_token, group_name)

        # Add user to the keycloak group '$group_name'
        headers = {
            'Content-Type': ContentType.JSON.value,
            'Authorization': f'Bearer {admin_token}'
        }
        remove_group_url = f'{base_url}/auth/admin/realms/{realm}/users/{user_id}/groups/{group_id}'
        response = requests.delete(remove_group_url, headers=headers,
                                   timeout=timeout)
        response.raise_for_status()

    @staticmethod
    def add_user_to_group(user_id: str, group_name: str):
        """Add user to the keycloak group."""
        config = current_app.config
        base_url = config.get('KEYCLOAK_BASE_URL')
        realm = config.get('KEYCLOAK_REALMNAME')
        timeout = config.get('CONNECT_TIMEOUT', 60)
        # Create an admin token
        admin_token = KeycloakService._get_admin_token()
        # Get the '$group_name' group
        group_id = KeycloakService._get_group_id(admin_token, group_name)

        # Add user to the keycloak group '$group_name'
        headers = {
            'Content-Type': ContentType.JSON.value,
            'Authorization': f'Bearer {admin_token}'
        }
        add_to_group_url = f'{base_url}/auth/admin/realms/{realm}/users/{user_id}/groups/{group_id}'
        response = requests.put(add_to_group_url, headers=headers,
                                timeout=timeout)
        response.raise_for_status()

    @staticmethod
    def add_attribute_to_user(user_id: str, attribute_value: str, attribute_id: str = 'tenant_id'):
        """Add attribute to a keyclaok user.Default is set as tenant Id."""
        config = current_app.config
        base_url = config.get('KEYCLOAK_BASE_URL')
        realm = config.get('KEYCLOAK_REALMNAME')
        timeout = config.get('CONNECT_TIMEOUT', 60)
        admin_token = KeycloakService._get_admin_token()

        tenant_attributes = {
            attribute_id: attribute_value
        }

        user_url = f'{base_url}/auth/admin/realms/{realm}/users/{user_id}'
        headers = {'Authorization': f'Bearer {admin_token}'}
        response = requests.get(user_url, headers=headers, timeout=timeout)
        user_data = response.json()
        user_data.setdefault('attributes', {}).update(tenant_attributes)
        requests.put(user_url, json=user_data, headers=headers, timeout=timeout)
        response.raise_for_status()

    @staticmethod
    def remove_user_from_group(user_id: str, group_name: str):
        """Remove user from the keycloak group."""
        config = current_app.config
        base_url = config.get('KEYCLOAK_BASE_URL')
        realm = config.get('KEYCLOAK_REALMNAME')
        timeout = config.get('CONNECT_TIMEOUT', 60)
        # Create an admin token
        admin_token = KeycloakService._get_admin_token()
        # Get the '$group_name' group
        group_id = KeycloakService._get_group_id(admin_token, group_name)

        # Remove user from the keycloak group '$group_name'
        headers = {
            'Content-Type': ContentType.JSON.value,
            'Authorization': f'Bearer {admin_token}'
        }
        remove_from_group_url = f'{base_url}/auth/admin/realms/{realm}/users/{user_id}/groups/{group_id}'
        response = requests.delete(remove_from_group_url, headers=headers, timeout=timeout)
        response.raise_for_status()

    @staticmethod
    def add_user(user: dict):
        """Add user to Keycloak.Mainly used for Tests;Dont use it for actual user creation in application."""
        config = current_app.config
        # Add user and set password
        admin_token = KeycloakService._get_admin_token()

        base_url = config.get('KEYCLOAK_BASE_URL')
        realm = config.get('KEYCLOAK_REALMNAME')
        timeout = config.get('CONNECT_TIMEOUT', 60)

        # Add user to the keycloak group '$group_name'
        headers = {
            'Content-Type': ContentType.JSON.value,
            'Authorization': f'Bearer {admin_token}'
        }

        add_user_url = f'{base_url}/auth/admin/realms/{realm}/users'
        response = requests.post(add_user_url, data=json.dumps(user), headers=headers,
                                 timeout=timeout)
        response.raise_for_status()

        return KeycloakService.get_user_by_username(user.get('username'), admin_token)

    @staticmethod
    def get_user_by_username(username, admin_token=None):
        """Get user from Keycloak by username."""
        base_url = current_app.config.get('KEYCLOAK_BASE_URL')
        realm = current_app.config.get('KEYCLOAK_REALMNAME')
        timeout = current_app.config.get('CONNECT_TIMEOUT', 60)
        if not admin_token:
            admin_token = KeycloakService._get_admin_token()

        headers = {
            'Content-Type': ContentType.JSON.value,
            'Authorization': f'Bearer {admin_token}'
        }

        # Get the user and return
        query_user_url = f'{base_url}/auth/admin/realms/{realm}/users?username={username}'
        response = requests.get(query_user_url, headers=headers, timeout=timeout)
        return response.json()[0]

    @staticmethod
    def toggle_user_enabled_status(user_id, enabled):
        """Toggle the enabled status of a user in Keycloak."""
        base_url = current_app.config.get('KEYCLOAK_BASE_URL')
        realm = current_app.config.get('KEYCLOAK_REALMNAME')
        timeout = current_app.config.get('CONNECT_TIMEOUT', 60)
        admin_token = KeycloakService._get_admin_token()
        headers = {
            'Content-Type': ContentType.JSON.value,
            'Authorization': f'Bearer {admin_token}'
        }

        user_data = {
            'enabled': enabled  # Set the user's enabled status based on 'enable' parameter
        }

        # Update the user's enabled status
        update_user_url = f'{base_url}/auth/admin/realms/{realm}/users/{user_id}'
        response = requests.put(update_user_url, json=user_data, headers=headers, timeout=timeout)
        response.raise_for_status()

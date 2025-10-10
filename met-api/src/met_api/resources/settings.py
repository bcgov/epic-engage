# Copyright © 2021 Province of British Columbia
#
# Licensed under the Apache License, Version 2.0 (the 'License');
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an 'AS IS' BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""API endpoints for managing settings."""

from http import HTTPStatus

from flask import request
from flask_cors import cross_origin
from flask_restx import Namespace, Resource
from marshmallow import ValidationError

from met_api.auth import auth
from met_api.schemas.settings import SettingsSchema
from met_api.services.settings import SettingsService
from met_api.utils.roles import Role
from met_api.utils.tenant_validator import require_role
from met_api.utils.util import allowedorigins, cors_preflight

API = Namespace('settings', description='Endpoints for Settings Management')


@cors_preflight('GET, POST, OPTIONS')
@API.route('/')
class SettingsResource(Resource):
    """Resource for managing settings."""

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @auth.require
    def get():
        """Fetch settings."""
        try:
            settings = SettingsService.get_settings()
            return SettingsSchema(many=True).dump(settings), HTTPStatus.OK
        except ValueError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @require_role([Role.CREATE_ENGAGEMENT.value])
    def post():
        """Create new settings."""
        try:
            requestjson = request.get_json()
            setting = SettingsService.create_setting(requestjson)
            return SettingsSchema(many=False).dump(setting), HTTPStatus.CREATED
        except KeyError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR
        except ValueError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR
        except ValidationError as err:
            return str(err.messages), HTTPStatus.INTERNAL_SERVER_ERROR


@cors_preflight('GET, OPTIONS')
@API.route('/<setting_key>')
class SettingsByKeyResource(Resource):
    """Resource for managing settings by key."""

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @auth.require
    def get(setting_key: str):
        """Get settings by key."""
        try:
            setting = SettingsService.get_setting_by_key(setting_key)
            return SettingsSchema(many=False).dump(setting), HTTPStatus.OK
        except KeyError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR
        except ValueError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR
        except ValidationError as err:
            return str(err.messages), HTTPStatus.INTERNAL_SERVER_ERROR


@cors_preflight('PATCH, OPTIONS')
@API.route('/<setting_id>')
class SettingsByIdResource(Resource):
    """Resource for managing settings by ID."""

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @require_role([Role.CREATE_ENGAGEMENT.value])
    def patch(setting_id):
        """Update settings by ID."""
        try:
            requestjson = request.get_json()
            setting = SettingsService.update_setting(setting_id, requestjson)
            return SettingsSchema(many=False).dump(setting), HTTPStatus.OK
        except KeyError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR
        except ValueError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR
        except ValidationError as err:
            return str(err.messages), HTTPStatus.INTERNAL_SERVER_ERROR

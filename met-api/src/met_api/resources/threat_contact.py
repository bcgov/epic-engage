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
"""API endpoints for managing ThreatContacts."""

from http import HTTPStatus

from flask import jsonify, request
from flask_cors import cross_origin
from flask_restx import Namespace, Resource
from marshmallow import ValidationError

from met_api.auth import jwt as _jwt
from met_api.schemas.threat_contact import ThreatContactSchema
from met_api.services.threat_contact_service import ThreatContactService
from met_api.utils.roles import Role
from met_api.utils.tenant_validator import require_role
from met_api.utils.util import allowedorigins, cors_preflight


API = Namespace('threat_contacts', description='Endpoints for ThreatContact Management')


@cors_preflight('GET, OPTIONS')
@API.route('/<threat_contact_id>')
class Contact(Resource):
    """Resource for managing a contacts."""

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @_jwt.requires_auth
    def get(threat_contact_id):
        """Fetch a ThreatContact by id."""
        try:
            contact = ThreatContactService().get_threat_contact_by_id(threat_contact_id)
            return contact, HTTPStatus.OK
        except (KeyError, ValueError) as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR


@cors_preflight('GET, POST, OPTIONS, PATCH')
@API.route('/')
class Contacts(Resource):
    """Resource for managing contacts."""

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @require_role([Role.CREATE_ENGAGEMENT.value])
    def post():
        """Create a new ThreatContact."""
        try:
            request_json = request.get_json()
            request_json = ThreatContactSchema().load(request_json)
            result = ThreatContactService().create_threat_contact(request_json)
            return ThreatContactSchema().dump(result), HTTPStatus.OK
        except (KeyError, ValueError) as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR
        except ValidationError as err:
            return str(err.messages), HTTPStatus.INTERNAL_SERVER_ERROR

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @_jwt.requires_auth
    def get():
        """Fetch list of contacts."""
        try:
            contacts = ThreatContactService().get_threat_contacts()
            return jsonify(contacts), HTTPStatus.OK
        except (KeyError, ValueError) as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR

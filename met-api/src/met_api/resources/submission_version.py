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
"""API endpoints for managing submission version history."""

from http import HTTPStatus

from flask_cors import cross_origin
from flask_restx import Namespace, Resource

from met_api.auth import jwt as _jwt
from met_api.services.submission_version_service import SubmissionVersionService
from met_api.utils.util import allowedorigins, cors_preflight


API = Namespace('submission_versions', path='/', description='Endpoints for Submission Version History')


@cors_preflight('GET,OPTIONS')
@API.route('/submissions/<int:submission_id>/versions')
class SubmissionVersions(Resource):
    """Resource for getting submission version history."""

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @_jwt.requires_auth
    def get(submission_id):
        """Get all version snapshots for a submission."""
        try:
            versions = SubmissionVersionService.get_by_submission_id(submission_id)
            return versions, HTTPStatus.OK
        except ValueError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR

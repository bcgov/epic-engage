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
"""API endpoints for managing survey result."""

from http import HTTPStatus

from flask import current_app, jsonify
from flask_cors import cross_origin
from flask_restx import Namespace, Resource

from analytics_api.auth import jwt as _jwt
from analytics_api.utils import engagement_access_validator
from analytics_api.services.survey_result import SurveyResultService
from analytics_api.utils.util import allowedorigins, cors_preflight


API = Namespace('surveyresult', description='Endpoints for Survey result Management')
"""Custom exception messages
"""


def _withheld_report_response(engagement_id):
    """Say that the report is being withheld, when it is, rather than serving it as an empty one.

    A caller that cannot be told the results apart from an engagement that simply has none has no
    way to explain itself to the reader - the dashboard showed both as "No data available".
    """
    reason = engagement_access_validator.get_access_denial_reason(engagement_id)
    if not reason:
        return None
    return {
        'message': "This engagement's report is not available.",
        'reason': reason,
    }, HTTPStatus.FORBIDDEN


def _internal_report_denied_response(engagement_id):
    """Say why the caller may not read this internal report, or None when they may."""
    try:
        reason = engagement_access_validator.get_internal_report_denial_reason(engagement_id)
    except engagement_access_validator.MembershipCheckError as err:
        current_app.logger.error('Engagement membership check against met-api failed: %s', err)
        return {'message': 'Could not check engagement membership.'}, HTTPStatus.SERVICE_UNAVAILABLE
    if not reason:
        return None
    return {
        'message': "You aren't assigned to this engagement.",
        'reason': reason,
    }, HTTPStatus.FORBIDDEN


@cors_preflight('GET,OPTIONS')
@API.route('/<engagement_id>/internal')
class SurveyResultInternal(Resource):
    """Resource for managing a survey result for single engagement."""

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @_jwt.requires_auth
    def get(engagement_id):
        """Fetch survey result for a single engagement id."""
        try:
            denied = _internal_report_denied_response(engagement_id)
            if denied:
                return denied

            withheld = _withheld_report_response(engagement_id)
            if withheld:
                return withheld

            survey_result_record = SurveyResultService().get_survey_result(engagement_id,
                                                                           can_view_all_survey_results=True)

            if survey_result_record:
                return jsonify(data=survey_result_record), HTTPStatus.OK

            return 'Engagement was not found', HTTPStatus.NOT_FOUND
        except KeyError:
            return 'Engagement was not found', HTTPStatus.INTERNAL_SERVER_ERROR
        except ValueError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR


@cors_preflight('GET,OPTIONS')
@API.route('/<engagement_id>/public')
class SurveyResultExternal(Resource):
    """Resource for managing a survey result for single engagement."""

    @staticmethod
    @cross_origin(origins=allowedorigins())
    def get(engagement_id):
        """Fetch survey result for a single engagement id."""
        try:
            withheld = _withheld_report_response(engagement_id)
            if withheld:
                return withheld

            survey_result_record = SurveyResultService().get_survey_result(engagement_id,
                                                                           can_view_all_survey_results=False)

            if survey_result_record:
                return jsonify(data=survey_result_record), HTTPStatus.OK

            return 'Engagement was not found', HTTPStatus.NOT_FOUND
        except KeyError:
            return 'Engagement was not found', HTTPStatus.INTERNAL_SERVER_ERROR
        except ValueError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR

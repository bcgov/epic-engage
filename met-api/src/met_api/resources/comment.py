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
"""API endpoints for managing an comment resource."""

from http import HTTPStatus
import unicodedata
from urllib.parse import quote

from flask import current_app, Response, request
from flask_cors import cross_origin
from flask_restx import Namespace, Resource

from met_api.auth import auth
from met_api.models.pagination_options import PaginationOptions
from met_api.services.comment_service import CommentService
from met_api.services.proponent_export_service import ProponentExportService
from met_api.utils.dashboard_visibility import include_hidden_questions
from met_api.utils.roles import Role
from met_api.utils.tenant_validator import require_role
from met_api.utils.util import allowedorigins, cors_preflight


API = Namespace('comments', description='Endpoints for Comments Management')
"""Custom exception messages
"""


@cors_preflight('GET, OPTIONS')
@API.route('/survey/<survey_id>')
class SurveyComments(Resource):
    """Resource for managing multiple comments."""

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @auth.optional
    def get(survey_id):
        """Get comments page."""
        try:
            args = request.args

            pagination_options = PaginationOptions(
                page=args.get('page', None, int),
                size=args.get('size', None, int),
                sort_key=args.get('sort_key', 'id', str),
                sort_order=args.get('sort_order', 'asc', str),
            )
            comment_records = CommentService()\
                .get_comments_paginated(
                    survey_id,
                    pagination_options,
                    args.get('search_text', '', str),
            )
            return comment_records, HTTPStatus.OK
        except ValueError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR


@cors_preflight('GET, OPTIONS')
@API.route('/survey/<survey_id>/grouped')
class SurveyCommentsGrouped(Resource):
    """Resource for free-text comments grouped by question."""

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @auth.optional
    def get(survey_id):
        """Get free-text comments grouped by question."""
        try:
            records = CommentService().get_comments_grouped_by_question(
                survey_id, include_hidden=include_hidden_questions(survey_id))
            return records, HTTPStatus.OK
        except ValueError as err:
            current_app.logger.error('Error fetching grouped survey comments: %s', str(err))
            return 'Error fetching grouped survey comments.', HTTPStatus.INTERNAL_SERVER_ERROR


@cors_preflight('GET, OPTIONS')
@API.route('/survey/<survey_id>/sheet/staff')
class GeneratedStaffCommentsSheet(Resource):
    """Resource for managing multiple comments."""

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @require_role([Role.EXPORT_INTERNAL_COMMENT_SHEET.value])
    def get(survey_id):
        """Export comments."""
        try:

            response = CommentService().export_comments_to_spread_sheet_staff(survey_id)
            response_headers = dict(response.headers)
            bom = b'\xef\xbb\xbf'
            content = response.content if response.content.startswith(bom) else bom + response.content
            headers = {
                'content-type': 'text/csv; charset=utf-8',
                'content-disposition': response_headers.get('content-disposition'),
            }
            return Response(
                response=content,
                status=response.status_code,
                headers=headers
            )
        except ValueError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR


def _attachment_disposition(file_name: str) -> str:
    """Build a Content-Disposition header for a filename that may hold any character.

    Response headers must be Latin-1, and engagement names often carry en dashes or curly
    apostrophes, so the name goes in an RFC 5987 filename* with a plain ASCII filename as fallback.
    """
    ascii_name = unicodedata.normalize('NFKD', file_name).encode('ascii', 'ignore').decode('ascii')
    ascii_name = ascii_name.replace('\\', '').replace('"', '')
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(file_name, safe='')}"


@cors_preflight('GET, OPTIONS')
@API.route('/survey/<survey_id>/sheet/proponent')
class GeneratedProponentCommentsSheet(Resource):
    """Resource for the Public/Proponent comment export."""

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @require_role([Role.EXPORT_PROPONENT_COMMENT_SHEET.value])
    def get(survey_id):
        """Export the approved comments that are safe to share with the public and proponents."""
        try:
            stream, file_name = ProponentExportService().export_comments_to_spread_sheet(survey_id)
            headers = {
                'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'content-disposition': _attachment_disposition(file_name),
            }
            return Response(
                response=stream.getvalue(),
                status=HTTPStatus.OK,
                headers=headers
            )
        except KeyError:
            return 'Survey was not found', HTTPStatus.NOT_FOUND
        except ValueError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR

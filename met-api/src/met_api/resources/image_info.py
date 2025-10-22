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
"""API endpoints for managing an image uploads resource."""

from http import HTTPStatus

from flask import request
from flask_cors import cross_origin
from flask_restx import Namespace, Resource
from marshmallow import ValidationError

from met_api.models.pagination_options import PaginationOptions
from met_api.schemas.image_info import ImageInfoParameterSchema, ImageInfoSchema
from met_api.services.image_info_service import ImageInfoService
from met_api.utils.roles import Role
from met_api.utils.tenant_validator import require_role
from met_api.utils.util import allowedorigins, cors_preflight


API = Namespace('image_info', description='Endpoints for Image Info management')
"""Custom exception messages
"""


@cors_preflight('GET, POST, OPTIONS')
@API.route('/')
class ImageInfo(Resource):
    """Resource for managing image info."""

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @require_role([Role.CREATE_IMAGES.value])
    def get():
        """Fetch images."""
        try:
            args = request.args

            pagination_options = PaginationOptions(
                page=args.get('page', None, int),
                size=args.get('size', None, int),
                sort_key=args.get('sort_key', 'date_uploaded', str),
                sort_order=args.get('sort_order', 'desc', str),
            )

            search_options = {
                'search_text': args.get('search_text', '', type=str),
            }

            archived = args.get('archived', default=False, type=lambda v: v.lower() == 'true')

            images = ImageInfoService().get_images_paginated(pagination_options, search_options, archived)
            return images, HTTPStatus.OK
        except ValueError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @require_role([Role.CREATE_IMAGES.value])
    def post():
        """Create a new image upload."""
        try:
            request_json = ImageInfoParameterSchema().load(API.payload)
            image_model = ImageInfoService().create_image_info(request_json)
            return ImageInfoSchema().dump(image_model), HTTPStatus.OK
        except KeyError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR
        except ValueError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR
        except ValidationError as err:
            return str(err.messages), HTTPStatus.INTERNAL_SERVER_ERROR


@cors_preflight('GET, PATCH, OPTIONS')
@API.route('/<int:image_info_id>')
class ImageInfoById(Resource):
    """Resource for managing image info by id."""

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @require_role([Role.CREATE_IMAGES.value])
    def patch(image_info_id):
        """Update image info by id."""
        try:
            request_json = ImageInfoParameterSchema().load(API.payload, partial=True)
            updated_image = ImageInfoService().update_image_info(image_info_id, request_json)
            if updated_image is None:
                return 'Image Info not found', HTTPStatus.NOT_FOUND
            return updated_image, HTTPStatus.OK
        except KeyError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR
        except ValueError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR
        except ValidationError as err:
            return str(err.messages), HTTPStatus.INTERNAL_SERVER_ERROR

    @staticmethod
    @cross_origin(origins=allowedorigins())
    @require_role([Role.CREATE_IMAGES.value])
    def delete(image_info_id):
        """Remove Image Info."""
        try:
            result = ImageInfoService().delete_image_info(image_info_id)
            if result:
                return 'Image Info successfully removed', HTTPStatus.OK
            return 'Image Info not found', HTTPStatus.NOT_FOUND
        except KeyError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR
        except ValueError as err:
            return str(err), HTTPStatus.INTERNAL_SERVER_ERROR

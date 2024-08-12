"""Service for image management."""
from met_api.models.pagination_options import PaginationOptions
from met_api.schemas.image_info import ImageInfoSchema
from met_api.services.object_storage_service import ObjectStorageService
from met_api.models.image_info import ImageInfo as ImageInfoModel


class ImageInfoService:
    """Image Info management service."""

    def __init__(self):
        """Initialize."""
        self.object_storage = ObjectStorageService()

    @staticmethod
    def get_images_paginated(self, pagination_options: PaginationOptions, search_options=None):
        """Get images paginated"""
        items, total = ImageInfoModel.get_images_paginated(
            pagination_options,
            search_options,
        )

        images = ImageInfoSchema(many=True).dump(items)

        return {
            'items': images,
            'total': total
        }

    @staticmethod
    def create_image_info(request_json: dict):
        """Create an Image Info upload"""
        new_image = ImageInfoModel(
            unique_name=request_json.get('unique_name', None),
            display_name=request_json.get('display_name', None),
            date_uploaded=request_json.get('date_uploaded', None),
        )
        new_image.save()
        new_image.commit()
        return new_image.find_by_id(new_image.id)

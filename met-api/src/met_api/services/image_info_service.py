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
    def get_images_paginated(pagination_options: PaginationOptions, search_options=None, archived=False):
        """Get images paginated."""
        items, total = ImageInfoModel.get_images_paginated(
            pagination_options,
            search_options,
            archived
        )

        images = ImageInfoSchema(many=True).dump(items)

        return {
            'items': images,
            'total': total
        }

    @staticmethod
    def create_image_info(request_json: dict):
        """Create an Image Info upload."""
        new_image = ImageInfoModel(
            unique_name=request_json.get('unique_name', None),
            display_name=request_json.get('display_name', None),
            date_uploaded=request_json.get('date_uploaded', None),
        )
        new_image.save()
        new_image.commit()
        return new_image.find_by_id(new_image.id)

    @staticmethod
    def update_image_info(image_info_id: int, request_json: dict):
        """Update an Image Info."""
        updated_image = ImageInfoModel.update(image_info_id, request_json)
        if updated_image:
            feedback_schema = ImageInfoSchema()
            return feedback_schema.dump(updated_image)
        return None

    @staticmethod
    def delete_image_info(image_info_id: int):
        """Delete an Image Info."""
        is_deleted = ImageInfoModel.delete_by_id(image_info_id)
        return is_deleted

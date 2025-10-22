"""Image Info schema class."""
from marshmallow import EXCLUDE, Schema, fields
from met_api.services.object_storage_service import ObjectStorageService


class ImageInfoSchema(Schema):
    """Image Info schema class."""

    def __init__(self, *args, **kwargs):
        """Initialize the Image Info schema class."""
        super().__init__(*args, **kwargs)
        self.object_storage = ObjectStorageService()

    class Meta:
        """Exclude unknown fields in the deserialized output."""

        unknown = EXCLUDE

    id = fields.Int(data_key='id')
    unique_name = fields.Str(data_key='unique_name', required=True)
    display_name = fields.Str(data_key='display_name', required=True)
    date_uploaded = fields.DateTime(data_key='date_uploaded')
    tenant_id = fields.Str(data_key='tenant_id')
    url = fields.Method('get_object_store_url', dump_only=True)
    archived = fields.Bool(data_key='archived')

    def get_object_store_url(self, obj):
        """Get the image URL from object storage."""
        if obj.unique_name:
            return self.object_storage.get_url(obj.unique_name)
        else:
            return None


class ImageInfoParameterSchema(Schema):
    """Schema for validating fields upon image info creation."""

    unique_name = fields.Str(
        metadata={'description': 'Unique name of the file'},
        required=True,
    )

    display_name = fields.Str(
        metadata={'description': 'Display name of the file'},
        required=True,
    )

    date_uploaded = fields.DateTime(
        metadata={'description': 'Date when file was uploaded'},
        required=True,
    )

    archived = fields.Bool(
        metadata={'description': 'Indicates if the image is archived'},
        required=False,
        missing=False,
    )

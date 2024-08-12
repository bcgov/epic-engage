from marshmallow import EXCLUDE, Schema, fields
from met_api.services.object_storage_service import ObjectStorageService


class ImageInfoSchema(Schema):
    """Schema for image info."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.object_storage = ObjectStorageService()

    class Meta:
        unknown = EXCLUDE
    
    id = fields.Int(data_key='id')
    unique_name = fields.Str(data_key='unique_name', required=True)
    display_name = fields.Str(data_key='display_name', required=True)
    date_uploaded = fields.DateTime(data_key='date_uploaded')
    tenant_id = fields.Str(data_key='tenant_id')
    url = fields.Method("get_object_store_url", dump_only=True)

    def get_object_store_url(self, obj):
        if obj.unique_name:
            return self.object_storage.get_url(obj.unique_name)
        else:
            return None

class ImageInfoParameterSchema(Schema):
    """Schema for validating fields upon image info creation"""

    unique_name = fields.Str(
        metadata={"description": "Unique name of the file"},
        required=True,
    )

    display_name = fields.Str(
        metadata={"description": "Display name of the file"},
        required=True,
    )

    date_uploaded = fields.DateTime(
        metadata={"description": "Date when file was uploaded"},
        required=True,
    )

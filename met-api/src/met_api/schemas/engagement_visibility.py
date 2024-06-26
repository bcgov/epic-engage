"""Engagement visibility schema class."""
from marshmallow import EXCLUDE, Schema, fields


class EngagementVisibilitySchema(Schema):
    """Schema for engagement visibility."""

    class Meta:  # pylint: disable=too-few-public-methods
        """Exclude unknown fields in the deserialized output."""

        unknown = EXCLUDE

    id = fields.Int(data_key='id')
    visibility_name = fields.Str(data_key='visibility_name')
    description = fields.Str(data_key='description')
    created_date = fields.Str(data_key='created_date')
    updated_date = fields.Str(data_key='updated_date')

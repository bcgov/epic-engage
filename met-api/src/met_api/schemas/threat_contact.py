"""Threat Contact schema class."""

from marshmallow import EXCLUDE, Schema, fields


class ThreatContactSchema(Schema):
    """ThreatContact schema."""

    class Meta:  # pylint: disable=too-few-public-methods
        """Exclude unknown fields in the deserialized output."""

        unknown = EXCLUDE

    id = fields.Int(data_key='id')
    first_name = fields.Str(data_key='first_name', required=True)
    last_name = fields.Str(data_key='last_name', required=True)
    email = fields.Str(data_key='email', required=True)
    tenant_id = fields.Int(data_key='tenant_id', required=False)
    created_date = fields.DateTime(data_key='created_date', required=False)
    updated_date = fields.DateTime(data_key='updated_date', required=False)
    created_by = fields.Str(data_key='created_by', required=False)
    updated_by = fields.Str(data_key='updated_by', required=False)

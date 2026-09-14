"""Survey schema class.

Manages the survey
"""

from marshmallow import EXCLUDE, Schema, fields

from met_api.schemas.utils import get_submission_counts
from .engagement import EngagementSchema


class SurveySchema(Schema):
    """Schema for survey."""

    class Meta:  # pylint: disable=too-few-public-methods
        """Exclude unknown fields in the deserialized output."""

        unknown = EXCLUDE

    id = fields.Int(data_key='id')
    name = fields.Str(data_key='name')
    form_json = fields.Dict(data_key='form_json')
    created_by = fields.Str(data_key='created_by')
    created_date = fields.Str(data_key='created_date')
    updated_by = fields.Str(data_key='updated_by')
    updated_date = fields.Str(data_key='updated_date')
    engagement_id = fields.Str(data_key='engagement_id')
    is_hidden = fields.Bool(data_key='is_hidden')
    is_template = fields.Bool(data_key='is_template')
    engagement = fields.Nested(EngagementSchema(exclude=('surveys',)))
    comments_meta_data = fields.Method('get_comments_meta_data')
    tenant_id = fields.Str(data_key='tenant_id')

    # Set by callers serializing a list, so the whole page shares one grouped count query.
    submission_counts = None

    def get_comments_meta_data(self, obj):
        """Get the meta data of the comments made in the survey."""
        return get_submission_counts(obj.id, self.submission_counts)

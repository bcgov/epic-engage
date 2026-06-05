"""Submission Version schema class.

Manages the submission version serialization.
"""

from marshmallow import EXCLUDE, Schema, fields


class SubmissionVersionSchema(Schema):
    """Schema for submission version."""

    class Meta:  # pylint: disable=too-few-public-methods
        """Exclude unknown fields in the deserialized output."""

        unknown = EXCLUDE

    id = fields.Int(data_key='id')
    submission_id = fields.Int(data_key='submission_id')
    version_number = fields.Int(data_key='version_number')
    comment_json = fields.List(fields.Dict(), data_key='comment_json')
    comment_status_id = fields.Int(data_key='comment_status_id')
    reviewed_by = fields.Str(data_key='reviewed_by')
    review_date = fields.Str(data_key='review_date')
    has_personal_info = fields.Bool(data_key='has_personal_info')
    has_profanity = fields.Bool(data_key='has_profanity')
    has_threat = fields.Bool(data_key='has_threat')
    rejected_reason_other = fields.Str(data_key='rejected_reason_other')
    notify_email = fields.Bool(data_key='notify_email')
    staff_note_json = fields.List(fields.Dict(), data_key='staff_note_json')
    submission_json = fields.Dict(data_key='submission_json')
    created_date = fields.Str(data_key='created_date')

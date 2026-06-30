"""Comment model class.

Manages the comment
"""

from marshmallow import EXCLUDE, Schema, fields


def _find_component_label(components, component_id):
    """Recursively search a form.io component tree for a component's label.

    Handles wizard pages and nested containers (panels, columns, well, etc.)
    where the components/columns are nested arbitrarily deep.
    """
    for component in components or []:
        if component.get('key', None) == component_id:
            return component.get('label', None)

        # Recurse into nested components (panels, wells, wizard pages, ...)
        nested = component.get('components', None)
        if nested:
            label = _find_component_label(nested, component_id)
            if label is not None:
                return label

        # Recurse into column layouts which hold their own components list
        for column in component.get('columns', []) or []:
            label = _find_component_label(column.get('components', []), component_id)
            if label is not None:
                return label

    return None


class CommentSchema(Schema):
    """Schema for comment."""

    class Meta:  # pylint: disable=too-few-public-methods
        """Exclude unknown fields in the deserialized output."""

        unknown = EXCLUDE

    id = fields.Int(data_key='id')
    text = fields.Str(data_key='text')
    submission_date = fields.Date(data_key='submission_date')
    reviewed_by = fields.Str(data_key='reviewed_by')
    review_date = fields.Str(data_key='review_date')
    status_id = fields.Int(data_key='status_id')
    survey_id = fields.Int(data_key='survey_id')
    submission_id = fields.Int(data_key='submission_id')
    is_displayed = fields.Bool(data_key='is_displayed')
    status_id = fields.Method('get_comment_status_id')
    reviewed_by = fields.Method('get_comment_reviewed_by')
    label = fields.Method('get_comment_label')

    def get_comment_status_id(self, obj):
        """Get the associated status of the comment."""
        return obj.submission.comment_status_id

    def get_comment_reviewed_by(self, obj):
        """Get the associated reviewed by of the comment."""
        return obj.submission.reviewed_by

    def get_comment_label(self, obj):
        """Get the associated label of the comment.

        Recursively walks the form_json so it works for both single page ('form')
        and multi page ('wizard') surveys, as well as nested components.
        """
        components = obj.survey.form_json.get('components', [])
        return _find_component_label(components, obj.component_id)


class PublicCommentSchema(Schema):
    """Schema for public comment."""

    class Meta:  # pylint: disable=too-few-public-methods
        """Exclude unknown fields in the deserialized output."""

        unknown = EXCLUDE

    id = fields.Int(data_key='id')
    text = fields.Str(data_key='text')
    label = fields.Method('get_comment_label')

    def get_comment_label(self, obj):
        """Get the associated label of the comment.

        Recursively walks the form_json so it works for both single page ('form')
        and multi page ('wizard') surveys, as well as nested components.
        """
        components = obj.survey.form_json.get('components', [])
        return _find_component_label(components, obj.component_id)

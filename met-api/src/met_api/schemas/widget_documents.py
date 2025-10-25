"""Widget schema class."""

from marshmallow_sqlalchemy import SQLAlchemyAutoSchema

from met_api.models.widget_documents import WidgetDocuments as WidgetDocumentModel


class WidgetDocumentsSchema(SQLAlchemyAutoSchema):
    """Widget Documents schema."""

    class Meta:  # pylint: disable=too-few-public-methods
        """Exclude unknown fields in the deserialized output."""

        model = WidgetDocumentModel
        load_instance = True
        include_fk = True

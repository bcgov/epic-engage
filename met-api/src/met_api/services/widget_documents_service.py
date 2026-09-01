"""Service for widget Document management."""
from http import HTTPStatus

from anytree import AnyNode
from anytree.exporter import DictExporter
from anytree.search import find_by_attr

from met_api.constants.membership_type import MembershipType
from met_api.exceptions.business_exception import BusinessException
from met_api.models.widget import Widget as WidgetModel
from met_api.models.widget_documents import WidgetDocuments as WidgetDocumentsModel
from met_api.services import authorization
from met_api.utils.enums import WidgetDocumentType
from met_api.utils.roles import Role


class WidgetDocumentService:
    """Widget Documents management service."""

    @staticmethod
    def _check_authorization(widget_id):
        """Ensure the user can edit the engagement that owns this widget."""
        widget = WidgetModel.get_widget_by_id(widget_id)
        if not widget:
            raise BusinessException(
                error='Widget not found',
                status_code=HTTPStatus.NOT_FOUND)
        one_of_roles = (
            MembershipType.TEAM_MEMBER.name,
            Role.EDIT_ENGAGEMENT.value
        )
        authorization.check_auth(one_of_roles=one_of_roles, engagement_id=widget.engagement_id)

    @staticmethod
    def get_documents_by_widget_id(widget_id):
        """Get documents by widget id."""
        docs = WidgetDocumentsModel.get_all_by_widget_id(widget_id)
        if not docs:
            return {}

        root = AnyNode()
        WidgetDocumentService._attach_root_nodes(docs, root)
        WidgetDocumentService._attach_child_file_nodes(docs, root)

        exporter = DictExporter()
        return exporter.export(root)

    @staticmethod
    def _sort_docs_by_index(docs):
        return sorted(docs, key=lambda doc: ((doc.sort_index or 0), doc.id))

    @staticmethod
    def _attach_root_nodes(docs, root):
        top_level_docs = list(filter(lambda doc: doc.parent_document_id is None, docs))
        for doc in WidgetDocumentService._sort_docs_by_index(top_level_docs):
            props = WidgetDocumentService._fetch_props(doc)
            AnyNode(**props, parent=root)

    @staticmethod
    def _attach_child_file_nodes(docs, root):
        child_files = list(filter(
            lambda doc: doc.type == WidgetDocumentType.FILE.value and doc.parent_document_id is not None,
            docs,
        ))
        for file in WidgetDocumentService._sort_docs_by_index(child_files):
            parent_node = find_by_attr(root, file.parent_document_id, name='id')
            if parent_node is None:
                continue
            props = WidgetDocumentService._fetch_props(file)
            AnyNode(**props, parent=parent_node)

    @staticmethod
    def _fetch_props(doc):
        props = {
            'id': doc.id,
            'type': doc.type,
            'title': doc.title,
            'sort_index': doc.sort_index,
            'url': doc.url,
            'parent_document_id': doc.parent_document_id,
            'is_uploaded': doc.is_uploaded,
        }
        # remove null
        return dict(props.items())

    @staticmethod
    def create_document(widget_id, doc_details):
        """Create documents for the widget."""
        WidgetDocumentService._check_authorization(widget_id)
        if parent_id := doc_details.get('parent_document_id', None):
            WidgetDocumentService._validate_parent_type(parent_id)

        doc = WidgetDocumentService._create_document_from_dict(doc_details, parent_id, widget_id)
        doc.save()
        return doc

    @staticmethod
    def _create_document_from_dict(doc_details, parent_id, widget_id):
        doc: WidgetDocumentsModel = WidgetDocumentsModel()
        doc.type = doc_details.get('type')
        doc.is_uploaded = doc_details.get('is_uploaded')
        doc.title = doc_details.get('title')
        doc.parent_document_id = parent_id
        doc.url = doc_details.get('url')
        doc.widget_id = widget_id
        sort_index = WidgetDocumentService._find_highest_sort_index(widget_id)
        doc.sort_index = sort_index + 1
        return doc

    @staticmethod
    def _find_highest_sort_index(widget_id):
        # find the highest sort order of the engagement
        sort_index = 0
        docs = WidgetDocumentsModel.get_all_by_widget_id(widget_id)
        if docs:
            # Find the largest in the existing widgets
            sort_index = max(doc.sort_index for doc in docs) or 0
        return sort_index

    @staticmethod
    def _validate_parent_type(parent_id):
        parent: WidgetDocumentsModel = WidgetDocumentsModel.find_by_id(parent_id)
        if parent is None:
            raise BusinessException(
                error='Parent Folder doesnt exist.',
                status_code=HTTPStatus.BAD_REQUEST)
        if parent.type == WidgetDocumentType.FILE.value:
            raise BusinessException(
                error='Cant nest inside file',
                status_code=HTTPStatus.BAD_REQUEST)

    @staticmethod
    def edit_document(widget_id, document_id, data: dict):
        """Update document from a document widget."""
        WidgetDocumentService._check_authorization(widget_id)
        document = WidgetDocumentsModel.find_by_id(document_id)
        if not document:
            raise BusinessException(
                error='Document to update was not found.',
                status_code=HTTPStatus.BAD_REQUEST)
        update_data = {
            **data,
            'url': data.get('url', document.url) if not document.is_uploaded else document.url,
        }
        updated_document = WidgetDocumentsModel.edit_widget_document(widget_id, document_id, update_data)
        return updated_document

    @staticmethod
    def delete_document(widget_id, document_id):
        """Remove document from a document widget."""
        WidgetDocumentService._check_authorization(widget_id)
        delete_document = WidgetDocumentsModel.remove_widget_document(widget_id, document_id)
        if not delete_document:
            raise BusinessException(
                error='Document to remove was not found.',
                status_code=HTTPStatus.BAD_REQUEST)
        return delete_document

    @staticmethod
    def sort_documents(widget_id, documents: list, user_id=None):
        """Sort widgets."""
        WidgetDocumentService._check_authorization(widget_id)
        WidgetDocumentService._validate_document_ids(widget_id, documents)

        document_sort_mappings = [{
            'id': document.get('id'),
            'sort_index': index + 1,
            'updated_by': user_id
        } for index, document in enumerate(documents)]

        WidgetDocumentsModel.update_documents(document_sort_mappings)

    @staticmethod
    def _validate_document_ids(widget_id, documents):
        """Validate if documents ids belong to the widget."""
        widget_documents = WidgetDocumentsModel.get_all_by_widget_id(widget_id)
        document_ids = [document.id for document in widget_documents]
        input_document_ids = [document_item.get('id') for document_item in documents]
        if len(set(input_document_ids) - set(document_ids)) > 0:
            raise BusinessException(
                error='Invalid widgets.',
                status_code=HTTPStatus.BAD_REQUEST)

# Copyright © 2019 Province of British Columbia
#
# Licensed under the Apache License, Version 2.0 (the 'License');
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an 'AS IS' BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


"""Service for document generation."""
import os

from flask import Response, send_file, current_app
from io import BytesIO
import pandas as pd

from met_api.models.generated_document_template import GeneratedDocumentTemplate
from met_api.services.cdogs_api_service import CdogsApiService


class DocumentGenerationService:  # pylint:disable=too-few-public-methods
    """document generation Service class."""

    def __init__(self):
        """Initiate the class."""
        self.cdgos_api_service = CdogsApiService()

    def generate_document(self, data, options):
        """Generate comment sheet."""
        if not options:
            raise ValueError('Options not provided')

        document_type = options.get('document_type')
        if not document_type:
            raise ValueError('Document type not provided')

        document_template: GeneratedDocumentTemplate = GeneratedDocumentTemplate() \
            .get_template_by_type(type_id=document_type)
        if document_template is None:
            raise ValueError('Template not saved in DB')

        template_cached = False
        if document_template.hash_code:
            current_app.logger.info('Checking if template %s is cached', document_template.hash_code)
            template_cached = self.cdgos_api_service.check_template_cached(document_template.hash_code)

        if document_template.hash_code is None or not template_cached:
            current_app.logger.info('Uploading new template')

            template_name = options.get('template_name')
            file_dir = os.path.dirname(os.path.realpath('__file__'))
            document_template_path = os.path.join(
                file_dir,
                'src/met_api/generated_documents_carbone_templates/',
                template_name
            )

            if not os.path.exists(document_template_path):
                raise ValueError('Template file does not exist')

            new_hash_code = self.cdgos_api_service.upload_template(template_file_path=document_template_path)
            if not new_hash_code:
                raise ValueError('Unable to obtain valid hashcode')
            document_template.hash_code = new_hash_code
            document_template.save()

        # Use pandas to create a DataFrame from your data
        # Extract titles
        titles = [title['label'] for title in data['titles']]

        # Extract comments
        comments_data = []
        for submission in data['comments']:
            submission_id = submission['submission_id']
            comment_texts = [comment['text'] for comment in submission['commentText']]
            comments_data.append({'submission_id': submission_id, **dict(zip(titles, comment_texts))})

        # Create DataFrame
        df = pd.DataFrame(comments_data)

        # Create an in-memory Excel file
        excel_buffer = BytesIO()

        # Use openpyxl to write DataFrame to Excel file with UTF-8 encoding
        with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Sheet1')

        # Seek to the beginning of the buffer before returning the response
        excel_buffer.seek(0)

        headers = {
            'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'content-disposition': 'attachment; filename=proponent_comments_sheet.xlsx',
        }

        # Return the binary data as a Flask response
        return Response(
            excel_buffer.read(),
            headers=headers,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            status=200
        )

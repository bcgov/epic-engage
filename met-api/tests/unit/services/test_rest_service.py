# Copyright © 2024 Province of British Columbia
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Tests for RestService._invoke body serialization."""
from unittest.mock import MagicMock, patch


def test_delete_does_not_send_null_body(app):
    """DELETE with no data must not serialize None to JSON null string."""
    with app.app_context():
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {'Content-Type': 'application/json'}

        with patch('met_api.services.rest_service.requests') as mock_requests:
            mock_requests.delete.return_value = mock_response
            from met_api.services.rest_service import RestService
            RestService.delete(endpoint='https://example.com/api/resource/1',
                               token='test-token', raise_for_status=False)

            _, call_kwargs = mock_requests.delete.call_args
            # data must be None (no body), not the string 'null'
            assert call_kwargs.get('data') is None, \
                'DELETE must not send null body — eagle-api returns 400 when body is JSON null'

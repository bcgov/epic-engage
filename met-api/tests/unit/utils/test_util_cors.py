# Copyright © 2019 Province of British Columbia
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

"""Tests to assure the CORS utilities.

Test-Suite to ensure that the CORS decorator is working as expected.
"""
import pytest

from met_api.utils.util import cors_preflight


TEST_CORS_METHODS_DATA = [
    ('GET'),
    ('PUT'),
    ('POST'),
    ('GET,PUT'),
    ('GET,POST'),
    ('PUT,POST'),
    ('GET,PUT,POST'),
]


@pytest.mark.parametrize('methods', TEST_CORS_METHODS_DATA)
def test_cors_preflight_allowed_origin(methods, app, monkeypatch):
    """Assert that an allowed origin is echoed back with credentials."""
    monkeypatch.setenv('CORS_ORIGIN', 'https://example.com,https://other.com')

    @cors_preflight(methods)  # pylint: disable=too-few-public-methods
    class TestCors():
        pass

    with app.test_request_context('/', headers={'Origin': 'https://example.com'}):
        rv = TestCors().options()  # pylint: disable=no-member

    assert rv[2]['Access-Control-Allow-Origin'] == 'https://example.com'
    assert rv[2]['Access-Control-Allow-Credentials'] == 'true'
    assert rv[2]['Access-Control-Allow-Methods'] == methods


@pytest.mark.parametrize('methods', TEST_CORS_METHODS_DATA)
def test_cors_preflight_disallowed_origin(methods, app, monkeypatch):
    """Assert that an unknown origin receives no CORS headers."""
    monkeypatch.setenv('CORS_ORIGIN', 'https://example.com,https://other.com')

    @cors_preflight(methods)  # pylint: disable=too-few-public-methods
    class TestCors():
        pass

    with app.test_request_context('/', headers={'Origin': 'https://evil.com'}):
        rv = TestCors().options()  # pylint: disable=no-member

    assert 'Access-Control-Allow-Origin' not in rv[2]
    assert 'Access-Control-Allow-Credentials' not in rv[2]
    assert rv[2]['Access-Control-Allow-Methods'] == methods

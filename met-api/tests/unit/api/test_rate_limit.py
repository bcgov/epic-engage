# Copyright © 2021 Province of British Columbia
#
# Licensed under the Apache License, Version 2.0 (the "License");
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

"""Tests to verify rate limiting on public endpoints.

Test-Suite to ensure that public (unauthenticated) endpoints are throttled per IP.
"""
import json

import pytest

from met_api import create_app
from met_api.config import TestConfig
from met_api.utils.enums import ContentType
from met_api.utils.limiter import limiter


@pytest.fixture()
def isolated_limiter():
    """Restore the limiter singleton after a test enables it.

    create_app() calls limiter.init_app(), which mutates the module-level
    singleton shared with the session-scoped app fixture: not just `enabled`
    but also the storage and the registered limits. Snapshot the whole
    instance state so an enabled limiter cannot leak into other tests.
    """
    saved = dict(limiter.__dict__)
    yield limiter
    limiter.__dict__.clear()
    limiter.__dict__.update(saved)


def test_public_endpoint_rate_limited(monkeypatch, session, isolated_limiter):  # pylint:disable=unused-argument
    """Assert that a public endpoint returns 429 once the configured per-IP limit is exceeded."""
    monkeypatch.setattr(TestConfig, 'RATELIMIT_ENABLED', True)
    monkeypatch.setattr(TestConfig, 'RATELIMIT_PUBLIC_WRITE', '3 per minute', raising=False)
    app = create_app('testing')
    client = app.test_client()

    # the invalid payload keeps each request from writing data
    # while still counting against the limit
    for _ in range(3):
        rv = client.post('/api/feedbacks/', data=json.dumps({}),
                         content_type=ContentType.JSON.value)
        assert rv.status_code != 429

    rv = client.post('/api/feedbacks/', data=json.dumps({}),
                     content_type=ContentType.JSON.value)
    assert rv.status_code == 429


def test_rate_limit_disabled_in_tests(client, session):  # pylint:disable=unused-argument
    """Assert that the shared test app has rate limiting disabled.

    Also guards against the enabled-limiter state from the test above leaking
    into the session-scoped app.
    """
    for _ in range(35):
        rv = client.post('/api/feedbacks/', data=json.dumps({}),
                         content_type=ContentType.JSON.value)
        assert rv.status_code != 429

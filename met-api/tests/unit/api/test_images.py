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

"""Tests to verify the Images API end-point.

Test-Suite to ensure that the /images endpoint is working as expected.
"""
import copy
import json
from http import HTTPStatus

import pytest
from faker import Faker

from met_api.models.tenant import Tenant as TenantModel
from met_api.utils.constants import TENANT_ID_HEADER
from met_api.utils.enums import ContentType
from tests.utilities.factory_scenarios import TestImageInfo, TestJwtClaims, TestTenantInfo
from tests.utilities.factory_utils import factory_auth_header, factory_tenant_model


fake = Faker()


def test_add_image(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that an image can be POSTed."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.met_admin_role)
    rv = client.post('/api/image_info/', data=json.dumps(TestImageInfo.image_1),
                     headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == HTTPStatus.OK.value


@pytest.mark.parametrize('role', [TestJwtClaims.no_role, TestJwtClaims.public_user_role])
def test_add_images_invalid_authorization(client, jwt, session, role):  # pylint:disable=unused-argument
    """Assert that an image can not be POSTed without authorization."""
    headers = factory_auth_header(jwt=jwt, claims=role)
    rv = client.post('/api/image_info/', data=json.dumps(TestImageInfo.image_1),
                     headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == HTTPStatus.UNAUTHORIZED.value


@pytest.mark.parametrize('image_data', [
    TestImageInfo.image_missing_unique_name,
    TestImageInfo.image_missing_display_name,
    TestImageInfo.image_missing_date_uploaded_name])
def test_add_images_invalid_data(client, jwt, session, image_data):  # pylint:disable=unused-argument
    """Assert that an image can not be POSTed with incorrect data."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.met_admin_role)
    rv = client.post('/api/image_info/', data=json.dumps(image_data),
                     headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == HTTPStatus.INTERNAL_SERVER_ERROR.value


def test_get_images(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that all images can be fetched."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.met_admin_role)
    rv = client.get('/api/image_info/', headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == HTTPStatus.OK.value


@pytest.mark.parametrize('role', [TestJwtClaims.no_role, TestJwtClaims.public_user_role])
def test_get_images_invalid_authorization(client, jwt, session, role):  # pylint:disable=unused-argument
    """Assert that all images can not be fetched without proper authorization."""
    headers = factory_auth_header(jwt=jwt, claims=role)
    rv = client.get('/api/image_info/', headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == HTTPStatus.UNAUTHORIZED.value


def test_cannot_get_images_with_different_tenant_ids(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that a user from tenant 1 cannot see images from tenant 2."""
    tenant_1 = TestTenantInfo.tenant1  # Create tenant 1
    factory_tenant_model(tenant_1)
    tenant_1_short_name = tenant_1.value['short_name']
    tenant_1 = TenantModel.find_by_short_name(tenant_1_short_name)
    assert tenant_1 is not None

    tenant_2 = TestTenantInfo.tenant2  # Create tenant 2
    factory_tenant_model(tenant_2)
    tenant_2_short_name = tenant_2.value['short_name']
    tenant_2 = TenantModel.find_by_short_name(tenant_2_short_name)
    assert tenant_2 is not None

    user_1 = copy.deepcopy(TestJwtClaims.met_admin_role.value)  # Create a user for tenant 1
    user_1['tenant_id'] = tenant_1.id

    user_2 = copy.deepcopy(TestJwtClaims.met_admin_role.value)  # Create a user for tenant 2
    user_2['tenant_id'] = tenant_2.id

    session.commit()

    headers = factory_auth_header(jwt=jwt, claims=user_1)
    headers[TENANT_ID_HEADER] = tenant_1_short_name
    rv = client.post('/api/image_info/', data=json.dumps(TestImageInfo.image_1),
                     headers=headers, content_type=ContentType.JSON.value)
    response_tenant_id = rv.json.get('tenant_id')
    user_tenant_id = user_1.get('tenant_id')
    assert int(response_tenant_id) == int(user_tenant_id)  # Create image for tenant 1

    headers = factory_auth_header(jwt=jwt, claims=user_1)
    headers[TENANT_ID_HEADER] = tenant_1_short_name
    rv = client.get('/api/image_info/', headers=headers, content_type=ContentType.JSON.value)
    assert rv.json.get('total') == 1  # Assert user 1 can see image

    headers = factory_auth_header(jwt=jwt, claims=user_2)
    headers[TENANT_ID_HEADER] = tenant_2_short_name
    rv = client.get('/api/image_info/', headers=headers, content_type=ContentType.JSON.value)
    assert rv.json.get('total') == 0  # Assert user from different tenant cannot see image

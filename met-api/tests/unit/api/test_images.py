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
import json
from http import HTTPStatus

from flask import current_app
import pytest
from faker import Faker

from met_api.models.image_info import ImageInfo
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
    other_tenant = factory_tenant_model(TestTenantInfo.tenant2)
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.met_admin_role)

    # Create two images for tenant 1
    image_1 = client.post('/api/image_info/', data=json.dumps(TestImageInfo.image_1),
                          headers=headers, content_type=ContentType.JSON.value)
    image_2 = client.post('/api/image_info/', data=json.dumps(TestImageInfo.image_1),
                          headers=headers, content_type=ContentType.JSON.value)

    # Fetch the images and assert we see both
    rv = client.get('/api/image_info/', headers=headers, content_type=ContentType.JSON.value)
    assert rv.json.get('total') == 2  # Assert we see just the 2 image for our tenant

    # Change the tenant_id of one of the images to be the other tenant
    image_info = session.query(ImageInfo).filter(ImageInfo.id == image_2.json.get('id')).one_or_none()
    image_info.tenant_id = other_tenant.id
    session.add(image_info)
    session.commit()

    # Fetch the images and assert we see just 1 now
    rv = client.get('/api/image_info/', headers=headers, content_type=ContentType.JSON.value)
    # Assert we see just the 1 image for our tenant
    assert rv.json.get('total') == 1
    # Check to make sure we get the right image
    assert rv.json.get('items')[0].get('id') == image_1.json.get('id')


def test_update_image_archived_status(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that an image's archived status can be updated."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.met_admin_role)

    # First create an image
    rv = client.post('/api/image_info/', data=json.dumps(TestImageInfo.image_1),
                     headers=headers, content_type=ContentType.JSON.value)
    image_id = rv.json.get('id')

    # Update the archived status
    update_data = {'archived': True}
    rv = client.patch(f'/api/image_info/{image_id}', data=json.dumps(update_data),
                      headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == HTTPStatus.OK.value

    # Verify the update in database
    image_info = session.query(ImageInfo).filter(ImageInfo.id == image_id).one_or_none()
    assert image_info.archived is True


@pytest.mark.parametrize('role', [TestJwtClaims.no_role, TestJwtClaims.public_user_role])
def test_update_image_archived_invalid_authorization(client, jwt, session, role):  # pylint:disable=unused-argument
    """Assert that an image's archived status cannot be updated without authorization."""
    admin_headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.met_admin_role)

    # First create an image as admin
    rv = client.post('/api/image_info/', data=json.dumps(TestImageInfo.image_1),
                     headers=admin_headers, content_type=ContentType.JSON.value)
    image_id = rv.json.get('id')

    # Try to update with invalid role
    headers = factory_auth_header(jwt=jwt, claims=role)
    update_data = {'archived': True}
    rv = client.patch(f'/api/image_info/{image_id}', data=json.dumps(update_data),
                      headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == HTTPStatus.UNAUTHORIZED.value


def test_update_nonexistent_image(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that updating a non-existent image returns appropriate error."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.met_admin_role)

    # Try to update a non-existent image
    update_data = {'archived': True}
    rv = client.patch('/api/image_info/99999', data=json.dumps(update_data),
                      headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == HTTPStatus.NOT_FOUND.value


def test_delete_image(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that an image can be deleted."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.met_admin_role)

    # First create an image
    rv = client.post('/api/image_info/', data=json.dumps(TestImageInfo.image_1),
                     headers=headers, content_type=ContentType.JSON.value)
    image_id = rv.json.get('id')

    # Delete the image
    rv = client.delete(f'/api/image_info/{image_id}', headers=headers)
    assert rv.status_code == HTTPStatus.OK.value

    # Verify the image is deleted from database
    image_info = session.query(ImageInfo).filter(ImageInfo.id == image_id).one_or_none()
    assert image_info is None


@pytest.mark.parametrize('role', [TestJwtClaims.no_role, TestJwtClaims.public_user_role])
def test_delete_image_invalid_authorization(client, jwt, session, role):  # pylint:disable=unused-argument
    """Assert that an image cannot be deleted without authorization."""
    admin_headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.met_admin_role)

    # First create an image as admin
    rv = client.post('/api/image_info/', data=json.dumps(TestImageInfo.image_1),
                     headers=admin_headers, content_type=ContentType.JSON.value)
    image_id = rv.json.get('id')

    # Try to delete with invalid role
    headers = factory_auth_header(jwt=jwt, claims=role)
    rv = client.delete(f'/api/image_info/{image_id}', headers=headers)
    assert rv.status_code == HTTPStatus.UNAUTHORIZED.value

    # Verify the image still exists
    image_info = session.query(ImageInfo).filter(ImageInfo.id == image_id).one_or_none()
    assert image_info is not None


def test_delete_nonexistent_image(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that deleting a non-existent image returns appropriate error."""
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.met_admin_role)

    # Try to delete a non-existent image
    rv = client.delete('/api/image_info/99999', headers=headers)
    assert rv.status_code == HTTPStatus.NOT_FOUND.value


def test_cannot_update_images_with_different_tenant_ids(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that a user from tenant 1 cannot update images from tenant 2."""
    current_app.config['IS_SINGLE_TENANT_ENVIRONMENT'] = False
    other_tenant = factory_tenant_model(TestTenantInfo.tenant2)
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.met_admin_role)

    # Create an image for tenant 1
    rv = client.post('/api/image_info/', data=json.dumps(TestImageInfo.image_1),
                     headers=headers, content_type=ContentType.JSON.value)
    image_id = rv.json.get('id')

    # Change the tenant_id of the image to be the other tenant
    image_info = session.query(ImageInfo).filter(ImageInfo.id == image_id).one_or_none()
    image_info.tenant_id = other_tenant.id
    session.add(image_info)
    session.commit()

    # Try to update the image (should fail since it belongs to different tenant)
    update_data = {'archived': True}
    rv = client.patch(f'/api/image_info/{image_id}', data=json.dumps(update_data),
                      headers=headers, content_type=ContentType.JSON.value)
    assert rv.status_code == HTTPStatus.NOT_FOUND.value


def test_cannot_delete_images_with_different_tenant_ids(client, jwt, session):  # pylint:disable=unused-argument
    """Assert that a user from tenant 1 cannot delete images from tenant 2."""
    current_app.config['IS_SINGLE_TENANT_ENVIRONMENT'] = False
    other_tenant = factory_tenant_model(TestTenantInfo.tenant2)
    headers = factory_auth_header(jwt=jwt, claims=TestJwtClaims.met_admin_role)

    # Create an image for tenant 1
    rv = client.post('/api/image_info/', data=json.dumps(TestImageInfo.image_1),
                     headers=headers, content_type=ContentType.JSON.value)
    image_id = rv.json.get('id')

    # Change the tenant_id of the image to be the other tenant
    image_info = session.query(ImageInfo).filter(ImageInfo.id == image_id).one_or_none()
    image_info.tenant_id = other_tenant.id
    session.add(image_info)
    session.commit()

    # Try to delete the image (should fail since it belongs to different tenant)
    rv = client.delete(f'/api/image_info/{image_id}', headers=headers)
    assert rv.status_code == HTTPStatus.NOT_FOUND.value

    # Verify the image still exists
    image_info = session.query(ImageInfo).filter(ImageInfo.id == image_id).one_or_none()
    assert image_info is not None

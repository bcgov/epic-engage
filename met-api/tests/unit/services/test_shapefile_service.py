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
"""Tests for the Shapefile Service.

Test suite to ensure that the Shapefile Service safely extracts uploaded zip
archives (rejecting zip-slip/zip-bomb payloads) and produces valid GeoJSON.
"""
import os
import tempfile
import zipfile
from io import BytesIO

import geopandas as gpd
import pytest
from shapely.geometry import Point
from werkzeug.datastructures import FileStorage

from met_api.exceptions.business_exception import BusinessException
from met_api.services.shapefile_service import ShapefileService


def _build_shapefile_zip():
    """Build an in-memory zip containing a real, valid shapefile."""
    gdf = gpd.GeoDataFrame({'name': ['a']}, geometry=[Point(1, 2)], crs='EPSG:4326')

    with tempfile.TemporaryDirectory() as shp_dir:
        shp_path = os.path.join(shp_dir, 'test.shp')
        gdf.to_file(shp_path)

        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
            for name in os.listdir(shp_dir):
                zip_file.write(os.path.join(shp_dir, name), arcname=name)
        zip_buffer.seek(0)
        return zip_buffer


def _zip_file_storage(zip_bytes, filename='shapefile.zip'):
    return FileStorage(stream=zip_bytes, filename=filename)


def _malicious_zip_file_storage(entry_name, content=b'malicious', filename='evil.zip'):
    """Build a FileStorage wrapping a zip with a single, attacker-controlled entry name."""
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
        zip_file.writestr(entry_name, content)
    zip_buffer.seek(0)
    return FileStorage(stream=zip_buffer, filename=filename)


@pytest.fixture
def shapefile_upload_folder(app, tmp_path):
    """Point SHAPEFILE_UPLOAD_FOLDER at an isolated tmp directory for the test."""
    original = app.config.get('SHAPEFILE_UPLOAD_FOLDER')
    upload_folder = str(tmp_path / 'shapefile-uploads')
    app.config['SHAPEFILE_UPLOAD_FOLDER'] = upload_folder
    yield upload_folder
    app.config['SHAPEFILE_UPLOAD_FOLDER'] = original


def test_convert_to_geojson_success(app, shapefile_upload_folder):  # pylint: disable=redefined-outer-name
    """A valid shapefile zip is converted to GeoJSON and its temp folder is cleaned up."""
    with app.app_context():
        zip_bytes = _build_shapefile_zip()
        file = _zip_file_storage(zip_bytes)

        geojson_string = ShapefileService.convert_to_geojson(file)

        assert '"FeatureCollection"' in geojson_string
        assert '"shape_render_index"' in geojson_string

        # The per-request temp directory should be removed, but the base upload
        # folder itself should be left intact for the next request to use.
        assert os.path.isdir(shapefile_upload_folder)
        assert os.listdir(shapefile_upload_folder) == []


def test_convert_to_geojson_cleans_up_on_failure(app, shapefile_upload_folder):  # pylint: disable=redefined-outer-name
    """The temp extraction folder is removed even when conversion raises."""
    with app.app_context():
        file = _malicious_zip_file_storage('readme.txt', content=b'not a shapefile')

        with pytest.raises(BusinessException):
            ShapefileService.convert_to_geojson(file)

        assert os.listdir(shapefile_upload_folder) == []


def test_convert_to_geojson_uses_isolated_folders_per_call(  # pylint: disable=redefined-outer-name
    app, shapefile_upload_folder, monkeypatch,
):
    """Concurrent/successive uploads must not reuse the same extraction directory."""
    with app.app_context():
        seen_dirs = []
        real_mkdtemp = tempfile.mkdtemp

        def recording_mkdtemp(*args, **kwargs):
            path = real_mkdtemp(*args, **kwargs)
            if kwargs.get('dir') == shapefile_upload_folder:
                seen_dirs.append(path)
            return path

        monkeypatch.setattr(tempfile, 'mkdtemp', recording_mkdtemp)

        zip_bytes_1 = _build_shapefile_zip()
        zip_bytes_2 = _build_shapefile_zip()
        ShapefileService.convert_to_geojson(_zip_file_storage(zip_bytes_1))
        ShapefileService.convert_to_geojson(_zip_file_storage(zip_bytes_2))

        assert len(seen_dirs) == 2
        assert seen_dirs[0] != seen_dirs[1]


def test_unzip_file_rejects_path_traversal(app, shapefile_upload_folder):  # pylint: disable=redefined-outer-name
    """A zip entry that escapes the extraction folder (zip-slip) is rejected."""
    with app.app_context():
        os.makedirs(shapefile_upload_folder, exist_ok=True)
        file = _malicious_zip_file_storage('../../etc/evil.shp')

        with pytest.raises(BusinessException, match='invalid entry paths'):
            ShapefileService.convert_to_geojson(file)


def test_unzip_file_rejects_absolute_path_entries(app, shapefile_upload_folder):  # pylint: disable=redefined-outer-name
    """A zip entry with an absolute path is rejected."""
    with app.app_context():
        os.makedirs(shapefile_upload_folder, exist_ok=True)
        file = _malicious_zip_file_storage('/etc/evil.shp')

        with pytest.raises(BusinessException, match='invalid entry paths'):
            ShapefileService.convert_to_geojson(file)


def test_convert_to_geojson_rejects_oversized_zip_upload(  # pylint: disable=redefined-outer-name
    app, shapefile_upload_folder, monkeypatch,
):
    """The raw uploaded zip is rejected if it exceeds MAX_ZIP_UPLOAD_SIZE, before it is opened."""
    monkeypatch.setattr(ShapefileService, 'MAX_ZIP_UPLOAD_SIZE', 10)

    with app.app_context():
        file = _malicious_zip_file_storage('readme.txt', content=b'not a shapefile')

        with pytest.raises(BusinessException, match='too large'):
            ShapefileService.convert_to_geojson(file)

        assert os.listdir(shapefile_upload_folder) == []


def test_safe_extract_rejects_too_many_entries(tmp_path, monkeypatch):
    """A zip with more entries than MAX_FILE_COUNT is rejected before extraction."""
    monkeypatch.setattr(ShapefileService, 'MAX_FILE_COUNT', 2)

    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
        zip_file.writestr('a.txt', 'a')
        zip_file.writestr('b.txt', 'b')
        zip_file.writestr('c.txt', 'c')
    zip_buffer.seek(0)

    with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
        with pytest.raises(BusinessException, match='too many entries'):
            ShapefileService._safe_extract(zip_ref, str(tmp_path))  # pylint: disable=protected-access


def test_safe_extract_rejects_zip_bomb(tmp_path, monkeypatch):
    """A zip whose declared uncompressed size exceeds MAX_UNCOMPRESSED_SIZE is rejected."""
    monkeypatch.setattr(ShapefileService, 'MAX_UNCOMPRESSED_SIZE', 10)

    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
        zip_file.writestr('big.txt', 'x' * 100)
    zip_buffer.seek(0)

    with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
        with pytest.raises(BusinessException, match='too large'):
            ShapefileService._safe_extract(zip_ref, str(tmp_path))  # pylint: disable=protected-access


def test_safe_extract_allows_valid_entries(tmp_path):
    """A well-formed zip within limits extracts without raising."""
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
        zip_file.writestr('fine.txt', 'ok')
    zip_buffer.seek(0)

    with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
        ShapefileService._safe_extract(zip_ref, str(tmp_path))  # pylint: disable=protected-access

    assert os.path.isfile(os.path.join(str(tmp_path), 'fine.txt'))


def test_convert_to_geojson_no_shapefile_found(app, shapefile_upload_folder):  # pylint: disable=redefined-outer-name
    """A zip without a .shp entry raises a BusinessException."""
    with app.app_context():
        file = _malicious_zip_file_storage('readme.txt', content=b'not a shapefile')

        with pytest.raises(BusinessException, match='No Valid shapefile found'):
            ShapefileService.convert_to_geojson(file)

        assert os.listdir(shapefile_upload_folder) == []

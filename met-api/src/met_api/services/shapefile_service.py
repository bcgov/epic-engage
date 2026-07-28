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


"""Service for shapefile service."""
from http import HTTPStatus
import json
import os
import shutil
import tempfile
import zipfile

from flask import current_app
import geopandas as gpd
from werkzeug.utils import secure_filename

from met_api.exceptions.business_exception import BusinessException


class ShapefileService:   # pylint: disable=too-few-public-methods
    """This is the shapefile related service class."""

    MAX_UNCOMPRESSED_SIZE = 200 * 1024 * 1024  # 200 MB total uncompressed
    MAX_FILE_COUNT = 10_000
    MAX_ZIP_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB uploaded zip

    @staticmethod
    def convert_to_geojson(file):
        """Convert to Geojson."""
        base_folder = current_app.config.get('SHAPEFILE_UPLOAD_FOLDER')
        os.makedirs(base_folder, exist_ok=True)
        upload_folder = tempfile.mkdtemp(dir=base_folder)
        try:
            shapefile_paths = ShapefileService._unzip_file(file, upload_folder)
            geojson_string = ShapefileService._get_geojson(shapefile_paths)
        finally:
            # Clean up uploaded files, even if extraction or parsing failed
            shutil.rmtree(upload_folder, ignore_errors=True)
        return geojson_string

    @staticmethod
    def _get_geojson(shapefile_paths):
        if isinstance(shapefile_paths, str):
            shapefile_paths = [shapefile_paths]

        merged_geojson = {
            'type': 'FeatureCollection',
            'features': [],
        }
        render_index = 0

        for shapefile_index, shapefile_path in enumerate(shapefile_paths):
            gdf = gpd.read_file(shapefile_path)

            # Check if the GeoDataFrame's CRS is not EPSG:4326, if so transform it to EPSG:4326
            if gdf.crs and gdf.crs.to_epsg() != 4326:
                gdf = gdf.to_crs(epsg=4326)

            geojson_dict = json.loads(gdf.to_json())
            features = geojson_dict.get('features', [])

            if not features:
                continue

            for feature in features:
                properties = feature.setdefault('properties', {})
                properties['shape_group_index'] = shapefile_index
                properties['shape_render_index'] = render_index

                merged_geojson['features'].append(feature)
                render_index += 1

        if not merged_geojson.get('features'):
            raise BusinessException(
                error='No Valid shapefile found.',
                status_code=HTTPStatus.BAD_REQUEST)

        geojson_string = json.dumps(merged_geojson)
        return geojson_string

    @staticmethod
    def _unzip_file(file, upload_folder):
        filename = secure_filename(file.filename)
        file_path = os.path.join(upload_folder, filename)
        file.save(file_path)

        if os.path.getsize(file_path) > ShapefileService.MAX_ZIP_UPLOAD_SIZE:
            raise BusinessException(
                error='Uploaded zip file is too large.',
                status_code=HTTPStatus.BAD_REQUEST)

        with zipfile.ZipFile(file_path, 'r') as zip_ref:
            ShapefileService._safe_extract(zip_ref, upload_folder)
            shapefile_names = ShapefileService._get_shapefile_names(zip_ref)
            if not shapefile_names:
                raise BusinessException(
                    error='No Valid shapefile found.',
                    status_code=HTTPStatus.BAD_REQUEST)

        shapefile_paths = [os.path.join(upload_folder, shapefile_name) for shapefile_name in shapefile_names]
        return shapefile_paths

    @staticmethod
    def _safe_extract(zip_ref, upload_folder):
        """Extract a zip archive, guarding against zip-slip and zip-bomb attacks."""
        members = zip_ref.infolist()

        if len(members) > ShapefileService.MAX_FILE_COUNT:
            raise BusinessException(
                error='Zip file contains too many entries.',
                status_code=HTTPStatus.BAD_REQUEST)

        upload_folder_real = os.path.realpath(upload_folder)
        total_uncompressed_size = 0

        for member in members:
            total_uncompressed_size += member.file_size
            if total_uncompressed_size > ShapefileService.MAX_UNCOMPRESSED_SIZE:
                raise BusinessException(
                    error='Zip file is too large when uncompressed.',
                    status_code=HTTPStatus.BAD_REQUEST)

            member_path = os.path.realpath(os.path.join(upload_folder, member.filename))
            if not (member_path == upload_folder_real or
                    member_path.startswith(upload_folder_real + os.sep)):
                raise BusinessException(
                    error='Zip file contains invalid entry paths.',
                    status_code=HTTPStatus.BAD_REQUEST)

        zip_ref.extractall(upload_folder)

    @staticmethod
    def _get_shapefile_names(zip_ref):
        shapefile_names = []
        for name in zip_ref.namelist():
            normalized_name = name.lower()
            if normalized_name.endswith('.shp') and 'macosx' not in normalized_name:
                shapefile_names.append(name)
        return shapefile_names

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
import json
import os
import shutil
import zipfile
from http import HTTPStatus

import geopandas as gpd
from flask import current_app
from werkzeug.utils import secure_filename

from met_api.exceptions.business_exception import BusinessException


class ShapefileService:   # pylint: disable=too-few-public-methods
    """This is the shapefile related service class."""

    @staticmethod
    def convert_to_geojson(file):
        """Convert to Geojson."""
        upload_folder = current_app.config.get('SHAPEFILE_UPLOAD_FOLDER')
        shapefile_paths = ShapefileService._unzip_file(file, upload_folder)
        geojson_string = ShapefileService._get_geojson(shapefile_paths)
        # Clean up uploaded files
        shutil.rmtree(os.path.join(upload_folder))
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
        ShapefileService._create_upload_dir(upload_folder)
        file_path = os.path.join(upload_folder, filename)
        file.save(file_path)
        with zipfile.ZipFile(file_path, 'r') as zip_ref:
            zip_ref.extractall(upload_folder)
            shapefile_names = ShapefileService._get_shapefile_names(zip_ref)
            if not shapefile_names:
                raise BusinessException(
                    error='No Valid shapefile found.',
                    status_code=HTTPStatus.BAD_REQUEST)

        shapefile_paths = [os.path.join(upload_folder, shapefile_name) for shapefile_name in shapefile_names]
        return shapefile_paths

    @staticmethod
    def _get_shapefile_names(zip_ref):
        shapefile_names = []
        for name in zip_ref.namelist():
            normalized_name = name.lower()
            if normalized_name.endswith('.shp') and 'macosx' not in normalized_name:
                shapefile_names.append(name)
        return shapefile_names

    @staticmethod
    def _create_upload_dir(upload_folder):
        is_exist = os.path.exists(upload_folder)
        if not is_exist:
            # Create a new directory because it does not exist
            os.makedirs(upload_folder)

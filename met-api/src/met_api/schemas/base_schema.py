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
"""Super class to handle all operations related to base schema."""

from marshmallow import fields, post_dump
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema


class BaseSchema(SQLAlchemyAutoSchema):  # pylint: disable=too-many-ancestors
    """Base Schema."""

    def __init__(self, *args, **kwargs):
        """Excludes versions. Otherwise database will query <name>_versions table."""
        super().__init__(*args, **kwargs)

    class Meta:  # pylint: disable=too-few-public-methods
        """Meta class to declare any class attributes."""

        load_instance = True
        datetimeformat = '%Y-%m-%dT%H:%M:%S+00:00'  # Default output date format.

    created_by = fields.Function(
        lambda obj: f'{obj.created_by.firstname} {obj.created_by.lastname}' if getattr(obj, 'created_by',
                                                                                       None) else None
    )

    updated_by = fields.Function(
        lambda obj: f'{obj.updated_by.firstname} {obj.updated_by.lastname}' if getattr(obj, 'updated_by',
                                                                                       None) else None
    )

    @post_dump
    def _remove_empty(self, data, many=False, **kwargs):
        if not isinstance(data, dict):
            return data

        # Create a copy of keys to avoid dictionary changed size during iteration
        keys_to_remove = []
        for key in data.keys():
            if key == 'versions' or data[key] is None:
                keys_to_remove.append(key)

        for key in keys_to_remove:
            del data[key]

        return data

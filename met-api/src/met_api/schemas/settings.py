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
"""Manager for setting schema."""


from marshmallow import Schema, fields

from met_api.models.settings import Settings


class SettingsSchema(Schema):  # pylint: disable=too-many-ancestors, too-few-public-methods
    """This is the schema for the Settings model."""

    class Meta:  # pylint: disable=too-few-public-methods
        """Maps all of the Settings fields to a default schema."""

        model = Settings

    id = fields.Int(data_key='id')
    setting_key = fields.Str(data_key='setting_key', required=True)
    setting_value = fields.Str(data_key='setting_value', allow_none=True)
    setting_value_type = fields.Str(data_key='setting_value_type', required=True)
    tenant_id = fields.Int(data_key='tenant_id', allow_none=True)
    created_by = fields.Str(data_key='created_by', allow_none=True)
    created_date = fields.Str(data_key='created_date', allow_none=True)
    updated_by = fields.Str(data_key='updated_by', allow_none=True)
    updated_date = fields.Str(data_key='updated_date', allow_none=True)

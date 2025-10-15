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
"""Manager for Event Item Schemas."""

from marshmallow import fields
import pytz
from met_api.models import EventItem as EventItemModel
from .base_schema import BaseSchema


class LocalizedDateTime(fields.DateTime):
    """Custom Marshmallow field to output datetime in the instance's timezone."""

    def __init__(self, tz_field_name, *args, **kwargs):
        """Initialize the field with the name of the timezone field."""
        super().__init__(*args, **kwargs)
        self.tz_field_name = tz_field_name

    def _serialize(self, value, attr, obj, **kwargs):
        if value is None:
            return None
        tz_name = getattr(obj, self.tz_field_name, None)
        if tz_name:
            tz = pytz.timezone(tz_name)
            value = value.astimezone(tz)
        return super()._serialize(value, attr, obj, **kwargs)


class EventItemSchema(BaseSchema):  # pylint: disable=too-many-ancestors, too-few-public-methods
    """This is the schema for the Contact link model."""

    start_date = LocalizedDateTime(tz_field_name='timezone', timezone=True)
    end_date = LocalizedDateTime(tz_field_name='timezone', timezone=True)
    timezone = fields.String()

    class Meta(BaseSchema.Meta):  # pylint: disable=too-few-public-methods
        """Maps all of the Widget Events fields to a default schema."""

        model = EventItemModel

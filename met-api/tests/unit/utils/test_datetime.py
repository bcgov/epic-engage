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

"""Tests to verify the datetime utilities.

Test-Suite to ensure BC local time resolves against permanent DST.
"""
from datetime import datetime, timedelta

import pytz

from met_api.utils.datetime import BC_TIMEZONE


def test_bc_stays_on_utc_minus_7_in_december():
    """BC stopped changing its clocks on 2026-11-01, so December is UTC-7.

    Fails against a pytz older than 2026.3, whose tz database predates the rule
    and still falls BC back to UTC-8.
    """
    december = pytz.timezone(BC_TIMEZONE).localize(datetime(2026, 12, 1, 12))

    assert december.utcoffset() == timedelta(hours=-7)

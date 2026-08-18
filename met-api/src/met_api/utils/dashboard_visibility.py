# Copyright © 2021 Province of British Columbia
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
"""Resolve whether a dashboard request may see questions hidden from the public report."""
from flask import request

from met_api.constants.dashboard_type import DashboardType
from met_api.utils.roles import Role
from met_api.utils.token_info import TokenInfo


def include_hidden_questions() -> bool:
    """Whether the current request should see questions staff excluded from the public report."""
    requested = request.args.get('dashboard_type', DashboardType.PUBLIC.value)
    if requested != DashboardType.INTERNAL.value:
        return False

    return Role.VIEW_ALL_SURVEY_RESULTS.value in TokenInfo.get_user_roles()

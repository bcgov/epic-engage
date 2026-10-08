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
from met_api.models.membership import Membership as MembershipModel
from met_api.models.staff_user import StaffUser as StaffUserModel
from met_api.models.survey import Survey as SurveyModel
from met_api.utils.enums import MembershipStatus
from met_api.utils.roles import Role
from met_api.utils.token_info import TokenInfo


def include_hidden_questions(survey_id) -> bool:
    """Whether the current request should see questions staff excluded from the public report."""
    requested = request.args.get('dashboard_type', DashboardType.PUBLIC.value)
    if requested != DashboardType.INTERNAL.value:
        return False

    if Role.VIEW_ALL_SURVEY_RESULTS.value in TokenInfo.get_user_roles():
        return True

    return _is_assigned_to_survey_engagement(survey_id)


def _is_assigned_to_survey_engagement(survey_id) -> bool:
    external_id = TokenInfo.get_id()
    if not external_id:
        return False

    survey = SurveyModel.find_by_id(survey_id)
    if not survey or not survey.engagement_id:
        return False

    user = StaffUserModel.get_user_by_external_id(external_id)
    if not user:
        return False

    membership = MembershipModel.find_by_engagement_and_user_id(
        survey.engagement_id, user.id, status=MembershipStatus.ACTIVE.value)
    return membership is not None

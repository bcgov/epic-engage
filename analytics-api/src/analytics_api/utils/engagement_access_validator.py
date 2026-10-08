"""Check Engagement Access Service."""
import requests
from flask import current_app, request
from sqlalchemy import and_
from sqlalchemy.sql.expression import true
from analytics_api.constants.engagement_status import Status
from analytics_api.models.db import db
from analytics_api.models.engagement import Engagement as EngagementModel
from analytics_api.utils.roles import Role
from analytics_api.utils.token_info import TokenInfo

# Why the public may not see an engagement's report. Sent to the dashboard so it can say what is
# holding the report back rather than showing it as an empty one.
ENGAGEMENT_UNPUBLISHED = 'engagement_unpublished'
SEND_REPORT_OFF = 'send_report_off'
NOT_ASSIGNED = 'not_assigned'


def get_access_denial_reason(engagement_id):
    """
    Return why this engagement's report is being withheld, or None when it may be shown.

    Public users will not be able to access engagement details if the engagement is unpublished or
    if the send report setting is turned off.

    Staff Users with the `ACCESS_DASHBOARD` role, such as administrators or team members,
    will always have access to engagement details, regardless of the engagement's visibility
    settings. Note that only an endpoint that parses the caller's token can see those roles - on
    one that doesn't, staff are held to the same rules as everyone else.
    """
    if Role.ACCESS_DASHBOARD.value in set(TokenInfo.get_user_roles()):
        return None

    engagements = db.session.query(EngagementModel.status_name, EngagementModel.send_report).filter(
        and_(
            EngagementModel.source_engagement_id == engagement_id,
            EngagementModel.is_active == true()
        )
    ).all()

    for engagement in engagements:
        if engagement.status_name == Status.Unpublished.value:
            return ENGAGEMENT_UNPUBLISHED
        if engagement.send_report is False:
            return SEND_REPORT_OFF

    return None


def check_engagement_access(engagement_id):
    """Check if user has access to get engagement details."""
    return get_access_denial_reason(engagement_id) is None


class MembershipCheckError(Exception):
    """Raised when the MET API is unreachable or returns an unexpected response."""


def get_internal_report_denial_reason(engagement_id):
    """Return why the caller may not read this engagement's internal report, or None when they may."""
    if Role.VIEW_ALL_SURVEY_RESULTS.value in TokenInfo.get_user_roles():
        return None

    if str(engagement_id) in {str(engagement) for engagement in _assigned_engagement_ids()}:
        return None
    return NOT_ASSIGNED


def _assigned_engagement_ids():
    met_api_url = current_app.config.get('MET_API_URL')
    external_id = TokenInfo.get_id()
    if not met_api_url or not external_id:
        raise MembershipCheckError('MET_API_URL or caller id missing')

    try:
        response = requests.get(
            f'{met_api_url.rstrip("/")}/engagements/all/members/{external_id}',
            headers={'Authorization': request.headers.get('Authorization', '')},
            timeout=current_app.config.get('MET_API_TIMEOUT'),
        )
    except requests.exceptions.RequestException as err:
        raise MembershipCheckError(f'met-api unreachable: {err}') from err

    if response.status_code != 200:
        raise MembershipCheckError(f'met-api answered {response.status_code}')

    try:
        return [membership['engagement_id'] for membership in response.json()]
    except (ValueError, TypeError, KeyError) as err:
        raise MembershipCheckError(f'met-api answered with an unreadable body: {err}') from err

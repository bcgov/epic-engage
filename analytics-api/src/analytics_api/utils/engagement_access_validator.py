"""Check Engagement Access Service."""
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

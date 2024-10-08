"""Check Engagement Access Service."""
from sqlalchemy import and_, exists, or_
from sqlalchemy.sql.expression import true
from analytics_api.constants.engagement_status import Status
from analytics_api.models.db import db
from analytics_api.models.engagement import Engagement as EngagementModel
from analytics_api.utils.roles import Role
from analytics_api.utils.token_info import TokenInfo


def check_engagement_access(engagement_id):
    """
    Check if user has access to get engagement details.

    Public users will not be able to access engagement details if the engagement is unpublished or
    if the send report setting is turned off.

    Staff Users with the `ACCESS_DASHBOARD` role, such as administrators or team members,
    will always have access to engagement details, regardless of the engagement's visibility settings.
    """
    engagement_conditions = db.session.query(
        exists()
        .where(
            and_(
                EngagementModel.source_engagement_id == engagement_id,
                EngagementModel.is_active == true(),
                or_(
                    EngagementModel.status_name == Status.Unpublished.value,
                    EngagementModel.send_report.is_(False)
                )
            )
        )
    ).scalar()

    user_roles = set(TokenInfo.get_user_roles())

    return not engagement_conditions or Role.ACCESS_DASHBOARD.value in user_roles

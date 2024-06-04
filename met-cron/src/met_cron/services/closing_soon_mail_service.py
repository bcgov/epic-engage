from datetime import timedelta

from flask import current_app
from sqlalchemy import and_, func
from typing import List
from met_api.constants.engagement_status import Status
from met_api.constants.engagement_visibility import Visibility
from met_api.models.engagement import Engagement as EngagementModel
from met_api.utils.datetime import local_datetime
from met_api.utils.template import Template
from met_cron.models.db import db
from met_cron.services.mail_service import EmailService


class ClosingSoonEmailService:  # pylint: disable=too-few-public-methods
    """Mail for closing soon published engagements"""

    @staticmethod
    def do_mail():
        """Send Closing Soon mail when public engagements are closing."""
        offset_days: int = int(current_app.config.get('OFFSET_DAYS'))
        engagements_closing_soon = ClosingSoonEmailService.get_public_engagements_closing_soon(offset_days)
        template_id = current_app.config.get('ENGAGEMENT_CLOSING_SOON_EMAIL_TEMPLATE_ID', None)
        subject = current_app.config.get('ENGAGEMENT_CLOSING_SOON_EMAIL_SUBJECT')
        template = Template.get_template('engagement_closing_soon.html')
        if engagements_closing_soon is not None:
            for engagement in engagements_closing_soon:
                EmailService._send_email_notification_for_subscription(engagement.id, template_id,
                                                                        subject, template)

    @staticmethod
    def get_public_engagements_closing_soon(offset_days: int) -> List[EngagementModel]:
        """Get public engagements that are closing within two days. We only want to notify users of public engagements."""
        now = local_datetime()
        days_from_now = now + timedelta(days=offset_days)
        engagements = db.session.query(EngagementModel) \
            .filter(
                and_(
                    EngagementModel.status_id == Status.Published.value,
                    EngagementModel.visibility == Visiblity.Public.value,
                    func.date(EngagementModel.end_date) == func.date(days_from_now)
                )) \
            .all()
        return engagements

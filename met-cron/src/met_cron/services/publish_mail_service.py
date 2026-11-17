from datetime import datetime

from flask import current_app
from met_api.constants.notification_status import NotificationStatus
from met_api.models.email_queue import EmailQueue as EmailQueueModel
from met_api.utils.template import Template
from met_cron.models.db import db
from met_cron.services.mail_service import EmailService, raise_if_engagements_failed
from met_cron.utils.scrub import scrub_sensitive


class PublishEmailService:  # pylint: disable=too-few-public-methods
    """Mail for newly published engagements"""

    @staticmethod
    def do_mail():
        """Send mail by listening to the email_queue.

            1. Get N number of unprocessed records from the email_queue table
            2. Process each mail and send it to subscribed users

        """
        email_batch_size: int = int(current_app.config.get('MAIL_BATCH_SIZE'))
        mails = EmailQueueModel.get_unprocessed_mails_for_open_engagements(email_batch_size)
        mail: EmailQueueModel
        template_id = current_app.config.get('PUBLISH_ENGAGEMENT_EMAIL_TEMPLATE_ID', None)
        subject = current_app.config.get('PUBLISH_ENGAGEMENT_EMAIL_SUBJECT')
        template = Template.get_template('publish_engagement.html')
        failed_engagement_ids = []
        for mail in mails:
            entity_id = mail.entity_id
            # Process each mails.First set status as PROCESSING
            mail.notification_status = NotificationStatus.PROCESSING.value
            mail.updated_date = datetime.utcnow()
            mail.commit()

            try:
                EmailService._send_email_notification_for_subscription(entity_id, template_id,
                                                                        subject, template)
                mail.notification_status = NotificationStatus.SENT.value
            except Exception as exc:  # noqa: B902
                db.session.rollback()
                failed_engagement_ids.append(entity_id)
                current_app.logger.error('<Publish email for engagement %s failed with %s: %s',
                                         entity_id, type(exc).__name__, scrub_sensitive(str(exc)))
                mail.notification_status = None
            mail.updated_date = datetime.utcnow()
            mail.commit()
        raise_if_engagements_failed(failed_engagement_ids)

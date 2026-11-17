from collections import namedtuple
from datetime import datetime
from http import HTTPStatus
from typing import List

from flask import current_app
from itsdangerous import BadData
from met_api.exceptions.business_exception import BusinessException
from met_api.models import Tenant as TenantModel
from met_api.models.engagement import Engagement as EngagementModel
from met_api.models.engagement_metadata import EngagementMetadataModel
from met_api.models.participant import Participant as ParticipantModel
from met_api.models.subscription import Subscription as SubscriptionModel
from met_api.services.email_verification_service import EmailVerificationService
from met_api.utils import notification
from met_cron.utils.scrub import scrub_sensitive
from met_cron.utils.subscription_checker import CheckSubscription
from sqlalchemy.exc import SQLAlchemyError

from met_cron.models.db import db

MAX_LOGGED_SUBSCRIPTION_IDS = 10

# attempted counts every send_email call, sent only the calls that returned without an error.
SendResult = namedtuple('SendResult', ['sent', 'attempted', 'failed', 'skipped'])


def raise_if_engagements_failed(failed_engagement_ids):
    """Fail the job after every engagement had its turn, so the run is still logged as failed."""
    if failed_engagement_ids:
        raise BusinessException(
            error=f'Sending emails failed for engagements {failed_engagement_ids}.',
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR)


class EmailService:  # pylint: disable=too-few-public-methods
    """Mail on updates."""

    @staticmethod
    def _send_email_notification_for_subscription(engagement_id, template_id, subject, template) -> SendResult:
        """Email every subscriber of the engagement; a failing subscriber is logged and skipped."""
        engagement: EngagementModel = EngagementModel.find_by_id(engagement_id)

        # find emails from the subscription table
        subscription_list: List[SubscriptionModel] = db.session.query(SubscriptionModel).distinct().filter(
            SubscriptionModel.is_subscribed == True).all()
        # The ids are read before any rollback can expire the rows, so a failure can always be logged.
        subscriptions = [(subscriber.id, subscriber.participant_id, subscriber) for subscriber in subscription_list]
        email_list = []
        sent = attempted = failed = skipped = 0
        failures = {}
        for subscription_id, participant_id, subscriber in subscriptions:
            try:
                if not CheckSubscription.check_subscription(subscriber, engagement_id):
                    continue
                participant = ParticipantModel.find_by_id(participant_id)
                if participant.email_address is None:
                    skipped += 1
                    continue
                email_address = ParticipantModel.decode_email(participant.email_address)
                if not notification.is_valid_email(email_address):
                    skipped += 1
                    continue
                if email_address in email_list:
                    continue
                email_list.append(email_address)
                body, args = EmailService._render_email_template(engagement, participant, template)
                attempted += 1
                notification.send_email(subject=subject,
                                        email=email_address,
                                        html_body=body,
                                        args=args,
                                        template_id=template_id)
                sent += 1
            except Exception as exc:  # noqa: B902
                failed += 1
                EmailService._record_failure(failures, subscription_id, exc)
                if isinstance(exc, SQLAlchemyError):
                    try:
                        db.session.rollback()
                    except Exception as rollback_exc:  # noqa: B902
                        EmailService._record_failure(failures, subscription_id, rollback_exc)

        for error_type, failure in failures.items():
            current_app.logger.warning('<Engagement %s: %s subscriptions failed with %s, ids %s: %s',
                                       engagement_id, len(failure['ids']), error_type,
                                       failure['ids'][:MAX_LOGGED_SUBSCRIPTION_IDS], failure['detail'])
        current_app.logger.info('<Engagement %s emails: %s sent, %s attempted, %s failed, %s skipped',
                                engagement_id, sent, attempted, failed, skipped)
        return SendResult(sent, attempted, failed, skipped)

    @staticmethod
    def _record_failure(failures, subscription_id, exc):
        # itsdangerous messages carry part of the signed address.
        detail = '' if isinstance(exc, BadData) else scrub_sensitive(str(exc))
        failure = failures.setdefault(type(exc).__name__, {'ids': [], 'detail': detail})
        failure['ids'].append(subscription_id)

    @staticmethod
    def _render_email_template(engagement, participant, template):
        site_url = notification.get_tenant_site_url(engagement.tenant_id)
        tenant_name = EmailService._get_tenant_name(engagement.tenant_id)
        metadata_model: EngagementMetadataModel = EngagementMetadataModel.find_by_id(engagement.id)
        project_name = None
        if metadata_model and 'project_name' in metadata_model.project_metadata:
            project_name = metadata_model.project_metadata.get('project_name')
        view_path = current_app.config.get('ENGAGEMENT_VIEW_PATH'). \
            format(engagement_id=engagement.id)
        # Generate secure unsubscribe token instead of using plain participant_id
        unsubscribe_token = EmailVerificationService.create_unsubscribe_token(
            participant.id, engagement.id)
        unsubscribe_url = current_app.config.get('UNSUBSCRIBE_PATH'). \
            format(token=unsubscribe_token)
        email_environment = current_app.config.get('EMAIL_ENVIRONMENT', '')
        args = {
            'project_name': project_name if project_name else engagement.name,
            'survey_url': f'{site_url}{view_path}',
            'end_date': datetime.strftime(engagement.end_date, EmailVerificationService.full_date_format),
            'tenant_name': tenant_name,
            'email_environment': email_environment,
            'unsubscribe_url': f'{site_url}{unsubscribe_url}',
        }
        body = template.render(
            project_name=args.get('project_name'),
            survey_url=args.get('survey_url'),
            end_date=args.get('end_date'),
            tenant_name=args.get('tenant_name'),
            email_environment=args.get('email_environment'),
            unsubscribe_url=args.get('unsubscribe_url'),
        )
        return body, args

    @staticmethod
    def _get_tenant_name(tenant_id):
        tenant = TenantModel.find_by_id(tenant_id)
        return tenant.name

from collections import namedtuple
from datetime import datetime
from http import HTTPStatus
from typing import List, Optional
from urllib.parse import urlparse

from flask import current_app
from itsdangerous import BadData
from requests import exceptions as request_errors
from sqlalchemy.exc import SQLAlchemyError
from urllib3.exceptions import ConnectTimeoutError, MaxRetryError

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
from met_cron.models.db import db

MAX_LOGGED_SUBSCRIPTION_IDS = 10
TOKEN_PATH_SUFFIX = '/protocol/openid-connect/token'

# Errors that mean the mail service never got the email. InvalidJSONError has no URL to check: it is safe
# only while met-api send_email reads JSON from the token response alone, never from the mail service.
NOT_DELIVERED_REQUEST_ERRORS = (
    request_errors.ConnectTimeout,
    request_errors.InvalidURL,
    request_errors.MissingSchema,
    request_errors.InvalidSchema,
    request_errors.InvalidHeader,
    request_errors.URLRequired,
    request_errors.InvalidJSONError,
)

# failed includes ambiguous: sends that raised after the mail service may have accepted them.
SendResult = namedtuple('SendResult', ['sent', 'failed', 'ambiguous', 'skipped', 'duplicate'])


def raise_if_engagements_failed(failed_engagement_ids):
    """Fail the job after every engagement had its turn, so the run is still logged as failed."""
    if failed_engagement_ids:
        raise BusinessException(
            error=f'Sending emails failed for engagements {sorted(failed_engagement_ids)}.',
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR)


def may_have_been_delivered(exc) -> bool:
    """Return False only when the error proves the mail service never received the email."""
    if not isinstance(exc, request_errors.RequestException):
        return False
    url = getattr(exc.request, 'url', None)
    if url and urlparse(url).path.endswith(TOKEN_PATH_SUFFIX):
        return False
    if isinstance(exc, NOT_DELIVERED_REQUEST_ERRORS):
        return False
    if isinstance(exc, request_errors.ConnectionError) and exc.args and isinstance(exc.args[0], MaxRetryError) \
            and isinstance(exc.args[0].reason, ConnectTimeoutError):
        return False
    if isinstance(exc, request_errors.HTTPError) and exc.response is not None and exc.response.status_code < 500:
        return False
    return True


def safe_rollback():
    """Roll back the session; a failing rollback is logged, never raised."""
    try:
        db.session.rollback()
    except Exception as exc:  # noqa: B902 # pylint:disable=broad-except
        current_app.logger.error('<Rollback failed with %s: %s', type(exc).__name__, scrub_sensitive(str(exc)))


def _record(bucket, reason, subscription_id, detail=''):
    entry = bucket.setdefault(reason, {'ids': [], 'detail': detail})
    entry['ids'].append(subscription_id)


def _unrecord(bucket, reason, subscription_id):
    entry = bucket[reason]
    entry['ids'].remove(subscription_id)
    if not entry['ids']:
        del bucket[reason]


def _log_buckets(engagement_id, bucket, outcome):
    for reason, entry in bucket.items():
        detail = f": {entry['detail']}" if entry['detail'] else ''
        current_app.logger.warning('<Engagement %s: %s subscriptions %s %s, ids %s%s',
                                   engagement_id, len(entry['ids']), outcome, reason,
                                   entry['ids'][:MAX_LOGGED_SUBSCRIPTION_IDS], detail)


class EmailService:  # pylint: disable=too-few-public-methods
    """Mail on updates."""

    @staticmethod
    def send_engagement_emails(engagement_id, template_id, subject, template, label) -> Optional[SendResult]:
        """Email the engagement's subscribers; returns None when the engagement itself failed."""
        try:
            return EmailService._send_email_notification_for_subscription(engagement_id, template_id, subject,
                                                                          template)
        except Exception as exc:  # noqa: B902 # pylint:disable=broad-except
            safe_rollback()
            current_app.logger.error('<%s email for engagement %s failed with %s: %s',
                                     label, engagement_id, type(exc).__name__, scrub_sensitive(str(exc)))
            return None

    @staticmethod
    def _send_email_notification_for_subscription(  # pylint: disable=too-many-locals
            engagement_id, template_id, subject, template) -> SendResult:
        """Email every subscriber of the engagement; a failing subscriber is logged and skipped."""
        engagement: EngagementModel = EngagementModel.find_by_id(engagement_id)

        # find emails from the subscription table
        subscription_list: List[SubscriptionModel] = db.session.query(SubscriptionModel).distinct().filter(
            SubscriptionModel.is_subscribed == True).all()
        # The ids are read before any rollback can expire the rows, so a failure can always be logged.
        subscriptions = [(subscriber.id, subscriber.participant_id, subscriber) for subscriber in subscription_list]
        email_addresses = set()
        undelivered = {}
        sent = failed = ambiguous = duplicate = 0
        failures = {}
        skips = {}
        for subscription_id, participant_id, subscriber in subscriptions:
            email_address = None
            try:
                if not CheckSubscription.check_subscription(subscriber, engagement_id):
                    continue
                participant = ParticipantModel.find_by_id(participant_id) if participant_id is not None else None
                if participant is None:
                    _record(skips, 'no participant', subscription_id)
                    continue
                if participant.email_address is None:
                    _record(skips, 'no address', subscription_id)
                    continue
                email_address = ParticipantModel.decode_email(participant.email_address)
                if not notification.is_valid_email(email_address):
                    _record(skips, 'invalid address', subscription_id)
                    continue
                if email_address in email_addresses:
                    duplicate += 1
                    continue
                body, args = EmailService._render_email_template(engagement, participant, template)
                notification.send_email(subject=subject,
                                        email=email_address,
                                        html_body=body,
                                        args=args,
                                        template_id=template_id)
                email_addresses.add(email_address)
                sent += 1
                # The address got its email after all, so its earlier failures were only duplicates.
                for error_type, failed_id in undelivered.pop(email_address, []):
                    failed -= 1
                    duplicate += 1
                    _unrecord(failures, error_type, failed_id)
            except Exception as exc:  # noqa: B902 # pylint:disable=broad-except
                failed += 1
                if may_have_been_delivered(exc):
                    ambiguous += 1
                    email_addresses.add(email_address)
                elif email_address is not None:
                    undelivered.setdefault(email_address, []).append((type(exc).__name__, subscription_id))
                # itsdangerous messages carry part of the signed address.
                detail = '' if isinstance(exc, BadData) else scrub_sensitive(str(exc))
                _record(failures, type(exc).__name__, subscription_id, detail)
                if isinstance(exc, SQLAlchemyError):
                    safe_rollback()

        skipped = sum(len(entry['ids']) for entry in skips.values())
        _log_buckets(engagement_id, failures, 'failed with')
        _log_buckets(engagement_id, skips, 'skipped')
        current_app.logger.info('<Engagement %s emails: %s checked, %s sent, %s failed (%s maybe delivered), '
                                '%s skipped, %s duplicate', engagement_id, sent + failed + skipped + duplicate,
                                sent, failed, ambiguous, skipped, duplicate)
        return SendResult(sent, failed, ambiguous, skipped, duplicate)

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

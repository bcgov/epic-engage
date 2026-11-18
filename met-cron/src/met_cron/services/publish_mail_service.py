"""Send the email for each newly published engagement in the email_queue."""
from datetime import datetime
from functools import partial

from flask import current_app
from met_api.constants.notification_status import NotificationStatus
from met_api.models.email_queue import EmailQueue as EmailQueueModel
from met_api.utils.template import Template
from met_cron.services.mail_service import EmailService, SendNotStartedError, raise_if_engagements_failed, safe_rollback
from met_cron.utils.scrub import scrub_sensitive


class PublishEmailService:  # pylint: disable=too-few-public-methods
    """Mail for newly published engagements."""

    @staticmethod
    def do_mail():
        """Send each unprocessed email_queue row to the engagement's subscribers."""
        max_attempts: int = current_app.config.get('MAIL_MAX_ATTEMPTS')
        backoff_minutes: int = current_app.config.get('MAIL_RETRY_BACKOFF_MINUTES')
        PublishEmailService._sweep_stale(current_app.config.get('MAIL_STALE_MINUTES'), max_attempts)
        mails = EmailQueueModel.get_unprocessed_mails_for_open_engagements(
            int(current_app.config.get('MAIL_BATCH_SIZE')), max_attempts, backoff_minutes)
        template_id = current_app.config.get('PUBLISH_ENGAGEMENT_EMAIL_TEMPLATE_ID', None)
        subject = current_app.config.get('PUBLISH_ENGAGEMENT_EMAIL_SUBJECT')
        template = Template.get_template('publish_engagement.html')
        failed_engagement_ids = set()
        # A rollback expires every loaded row, so the ids are read up front.
        rows = [(mail, mail.id, mail.entity_id) for mail in mails]
        for mail, mail_id, entity_id in rows:
            attempts, commit_try = PublishEmailService._commit_with_retry(
                partial(EmailQueueModel.claim, mail_id, max_attempts, backoff_minutes),
                mail_id, NotificationStatus.PROCESSING)
            if attempts is None:
                # Neither commit is known to have applied: if the row is still unprocessed, sending now
                # could mail everyone twice next run.
                failed_engagement_ids.add(entity_id)
                continue
            if not attempts and commit_try > 1:
                # The failed first commit may have applied, which leaves the row PROCESSING with nothing sent.
                current_app.logger.error('<Claim retry for email_queue %s found it already claimed', mail_id)
                failed_engagement_ids.add(entity_id)
                continue
            if not attempts:
                current_app.logger.info('Skipping email_queue %s: another run already claimed it', mail_id)
                continue

            try:
                result = EmailService.send_engagement_emails(
                    entity_id, template_id, subject, template, 'Publish',
                    before_first_send=partial(PublishEmailService._mark_send_started, mail_id, attempts))
            except SendNotStartedError:
                # Nothing was sent, but the row may belong to another claim now, so it is left for the stale sweep.
                failed_engagement_ids.add(entity_id)
                continue
            if result is None or result.failed:
                failed_engagement_ids.add(entity_id)
            if result is not None and (result.sent or not result.failed):
                status = NotificationStatus.SENT
            elif result is not None and result.ambiguous:
                # The mail service may have accepted a send: a retry could mail people twice.
                status = NotificationStatus.PROCESSING
            else:
                status = None
            if status is None:
                PublishEmailService._log_if_capped(mail_id, entity_id, attempts, max_attempts)
            if not PublishEmailService._save_status(mail, mail_id, status):
                failed_engagement_ids.add(entity_id)
        raise_if_engagements_failed(failed_engagement_ids)

    @staticmethod
    def _sweep_stale(stale_minutes, max_attempts):
        """Requeue rows claimed by a run that died before sending; only log stale rows that started sending."""
        for mail_id, entity_id, attempts in EmailQueueModel.requeue_stale_unstarted(stale_minutes):
            current_app.logger.warning('<Requeued email_queue %s for engagement %s: claimed over %s minutes ago, '
                                       'no send started', mail_id, entity_id, stale_minutes)
            PublishEmailService._log_if_capped(mail_id, entity_id, attempts, max_attempts)
        started_ids = EmailQueueModel.find_stale_started_ids(stale_minutes)
        if started_ids:
            # These may have been delivered, so requeuing them could mail people twice.
            current_app.logger.warning('<email_queue %s started sending over %s minutes ago with no final status; '
                                       'not requeued', started_ids, stale_minutes)

    @staticmethod
    def _mark_send_started(mail_id, attempts):
        if not EmailQueueModel.mark_send_started(mail_id, attempts):
            raise LookupError(f'email_queue {mail_id} was requeued or claimed again by another run')

    @staticmethod
    def _log_if_capped(mail_id, entity_id, attempts, max_attempts):
        if attempts >= max_attempts:
            current_app.logger.warning('email_queue %s for engagement %s failed %s send attempts; not retrying',
                                       mail_id, entity_id, attempts)

    @staticmethod
    def _save_status(mail, mail_id, status) -> bool:
        """Commit the row's status, retrying once after a rollback."""
        def write():
            mail.notification_status = status.value if status else None
            mail.updated_date = datetime.utcnow()
            mail.commit()
            return True
        return PublishEmailService._commit_with_retry(write, mail_id, status)[0] is not None

    @staticmethod
    def _commit_with_retry(write, mail_id, status):
        """Return (what write returns, attempt number), retrying once after a rollback; None when both fail."""
        for attempt in (1, 2):
            try:
                return write(), attempt
            except Exception as exc:  # noqa: B902 # pylint:disable=broad-except
                safe_rollback()
                current_app.logger.error('<Saving status %s for email_queue %s failed on attempt %s with %s: %s',
                                         status.name if status else 'unprocessed', mail_id, attempt,
                                         type(exc).__name__, scrub_sensitive(str(exc)))
        return None, attempt

from datetime import datetime, timedelta
from typing import List

from flask import current_app

from met_api.constants.engagement_status import Status as MetEngagementStatus
from met_api.constants.comment_status import Status as CommentStatus
from met_api.constants.user import SYSTEM_USER
from met_api.models.comment import Comment as MetCommentModel
from met_api.models.engagement import Engagement as MetEngagementModel
from met_api.models.submission import Submission as MetSubmissionModel
from met_api.models.submission_version import SubmissionVersion as MetSubmissionVersionModel
from met_cron.models.db import db, session_scope
from met_cron.models.user_feedback import UserFeedback as AnalyticsUserFeedbackModel
from sqlalchemy import and_


class CommentRedactService:  # pylint: disable=too-few-public-methods
    """Redaction Service on Comments."""

    @staticmethod
    def do_redact_comments():
        """Perform the redaction on rejected comments.

            1. Get submissions for engagements closed for N_DAYS
            2. Redact comments in comments table by submission_ids
            3. Redact comments in submission_json by submission_ids
            4. Redact comments in version history snapshots by submission_ids
            5. Redact the analytics database's copies of the same comments

        """
        submissions = CommentRedactService._find_submissions_for_n_days_closed_engagements(days=current_app.config.get('N_DAYS', 14))
        if not submissions:
            current_app.logger.info(f'>>>>>No Submissions for Engagements closed for {current_app.config.get("N_DAYS", 14)} days found.')
            return
        current_app.logger.info('>>>>>Total Submissions to redact found: %s.', len(submissions))
        submissions_ids = [submission.id for submission in submissions]
        with session_scope() as session:
            comment_ids = CommentRedactService._find_comment_ids(submissions_ids, session)
            CommentRedactService._redact_comments_by_submission_ids(submissions_ids, session)
            CommentRedactService._redact_submission_json_comments(submissions_ids, session)
            CommentRedactService._redact_version_history_comments(submissions_ids, session)
            CommentRedactService._redact_analytics_user_feedback(comment_ids, session)


    @staticmethod
    def _find_submissions_for_n_days_closed_engagements(days) -> List[MetSubmissionModel]:
        current_app.logger.info(f'>>>>>Finding submissions for Engagements closed for {days} days.')
        n_days_ago = datetime.utcnow().date() - timedelta(days=days)
        return db.session.query(MetSubmissionModel)\
            .join(MetEngagementModel, MetEngagementModel.id == MetSubmissionModel.engagement_id)\
            .filter(and_(
                MetEngagementModel.end_date <= n_days_ago,
                MetEngagementModel.status_id == MetEngagementStatus.Closed.value,
                MetSubmissionModel.comment_status_id == CommentStatus.Rejected.value,
                MetSubmissionModel.has_threat.is_(False)))\
            .all()


    @staticmethod
    def _find_comment_ids(submission_ids: List[int], session) -> List[int]:
        """Return the ids of the comments belonging to the given submissions.

        Collected before anything is redacted, because the analytics copies are
        matched on the MET comment id rather than on the submission.
        """
        return [row.id for row in session.query(MetCommentModel.id)
                .filter(MetCommentModel.submission_id.in_(submission_ids))
                .all()]


    @staticmethod
    def _redact_comments_by_submission_ids(submission_ids: List[int], session):
        current_app.logger.info('>>>>>Redacting comments for %s submissions.', len(submission_ids))
        session.query(MetCommentModel)\
        .filter(MetCommentModel.submission_id.in_(submission_ids))\
        .update(
            {
                MetCommentModel.text: current_app.config.get('REDACTION_TEXT', '[Comment Redacted]'),
                MetCommentModel.updated_by: SYSTEM_USER,
                MetCommentModel.updated_date: datetime.utcnow(),
            },
            synchronize_session=False)


    @staticmethod
    def _redact_submission_json_comments(submission_ids: List[int], session):
        current_app.logger.info('>>>>>Fetching keys to redact aka component_types for %s submissions.',
                                len(submission_ids))
        comments = session.query(MetCommentModel)\
        .filter(MetCommentModel.submission_id.in_(submission_ids))\
        .all()
        # e.g. ['simpletextarea', 'simpletextarea1', 'simpletextfield']
        keys_to_redact = [comment.component_id for comment in comments]

        current_app.logger.info('>>>>>Redacting comments in submission_json for %s submissions.', len(submission_ids))
        for submission in session.query(MetSubmissionModel).filter(MetSubmissionModel.id.in_(submission_ids)):
            new_submission_json = {}
            for key, value in submission.submission_json.items():
                if key in keys_to_redact:
                    new_submission_json[key] = current_app.config.get('REDACTION_TEXT', '[Comment Redacted]')
                else:
                    new_submission_json[key] = value
            submission.submission_json = new_submission_json
            submission.updated_by = SYSTEM_USER
            submission.updated_date = datetime.utcnow()

    @staticmethod
    def _redact_version_history_comments(submission_ids: List[int], session):
        """Redact comment text in version history snapshots for the given submissions."""
        current_app.logger.info('>>>>>Redacting version history comments for %s submissions.', len(submission_ids))
        redaction_text = current_app.config.get('REDACTION_TEXT', '[Comment Redacted]')
        versions = session.query(MetSubmissionVersionModel)\
            .filter(MetSubmissionVersionModel.submission_id.in_(submission_ids))\
            .all()
        for version in versions:
            if version.comment_json:
                redacted_comments = []
                for comment in version.comment_json:
                    redacted_comment = {**comment, 'text': redaction_text}
                    redacted_comments.append(redacted_comment)
                version.comment_json = redacted_comments
                version.updated_by = SYSTEM_USER
                version.updated_date = datetime.utcnow()

    @staticmethod
    def _redact_analytics_user_feedback(comment_ids: List[int], session):
        """Redact the analytics database's copies of the same comments.

        The ETL copies approved comments into user_feedback and selects on
        submission_date, which a later review decision does not change. A comment
        approved first and rejected afterwards therefore keeps a readable copy in
        analytics that nothing else ever revisits. Rows are matched on
        source_comment_id, which the ETL sets to the MET comment id.

        Only the comment text is erased. sentiment_analysis and label are left as
        they are so reporting aggregates do not shift underneath the redaction.
        """
        if not comment_ids:
            return
        current_app.logger.info(f'>>>>>Redacting analytics user_feedback for comments: {comment_ids}')
        redacted_count = session.query(AnalyticsUserFeedbackModel)\
            .filter(AnalyticsUserFeedbackModel.source_comment_id.in_(comment_ids))\
            .update(
                {
                    AnalyticsUserFeedbackModel.comment: current_app.config.get('REDACTION_TEXT', '[Comment Redacted]'),
                    AnalyticsUserFeedbackModel.updated_date: datetime.utcnow(),
                },
                synchronize_session=False)
        current_app.logger.info('>>>>>Redacted %s analytics user_feedback rows.', redacted_count)

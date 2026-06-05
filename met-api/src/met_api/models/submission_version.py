"""Submission Version model class.

Manages versioned snapshots of submissions for resubmission history.
"""
from __future__ import annotations

from typing import List

from sqlalchemy import ForeignKey
from sqlalchemy.dialects import postgresql

from .base_model import BaseModel
from .db import db


class SubmissionVersion(BaseModel):  # pylint: disable=too-few-public-methods
    """Definition of the Submission Version entity.

    Captures a snapshot of a submission's state at the time it was rejected
    and subsequently resubmitted. This preserves the review history for
    version control display in the admin review UI.
    """

    __tablename__ = 'submission_version'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    submission_id = db.Column(db.Integer, ForeignKey('submission.id', ondelete='CASCADE'), nullable=False)
    version_number = db.Column(db.Integer, nullable=False)

    # Snapshot of comment text at time of rejection
    comment_json = db.Column(postgresql.JSONB(astext_type=db.Text()), nullable=False, server_default='[]')

    # Snapshot of the review decision
    comment_status_id = db.Column(db.Integer, ForeignKey('comment_status.id', ondelete='SET NULL'))
    reviewed_by = db.Column(db.String(50))
    review_date = db.Column(db.DateTime)

    # Rejection reasons
    has_personal_info = db.Column(db.Boolean, nullable=True)
    has_profanity = db.Column(db.Boolean, nullable=True)
    has_threat = db.Column(db.Boolean, nullable=True)
    rejected_reason_other = db.Column(db.String(500), nullable=True)
    notify_email = db.Column(db.Boolean(), default=True)

    # Staff notes snapshot (stored as JSON to avoid complex relational snapshot)
    staff_note_json = db.Column(postgresql.JSONB(astext_type=db.Text()), nullable=False, server_default='[]')

    # Original submission JSON snapshot
    submission_json = db.Column(postgresql.JSONB(astext_type=db.Text()), nullable=False, server_default='{}')

    @classmethod
    def get_by_submission_id(cls, submission_id: int) -> List[SubmissionVersion]:
        """Get all versions for a submission, ordered by version number."""
        return db.session.query(SubmissionVersion)\
            .filter(SubmissionVersion.submission_id == submission_id)\
            .order_by(SubmissionVersion.version_number.asc())\
            .all()

    @classmethod
    def get_latest_version_number(cls, submission_id: int) -> int:
        """Get the latest version number for a submission, or 0 if none exist."""
        result = db.session.query(db.func.max(SubmissionVersion.version_number))\
            .filter(SubmissionVersion.submission_id == submission_id)\
            .scalar()
        return result or 0

    @classmethod
    def create_version_snapshot(cls, submission, comments, staff_notes, session=None) -> SubmissionVersion:
        """Create a version snapshot of the current submission state.

        Args:
            submission: The Submission model instance (pre-update state).
            comments: List of Comment model instances.
            staff_notes: List of StaffNote model instances.
            session: Optional DB session.

        Returns:
            The created SubmissionVersion instance.
        """
        next_version = cls.get_latest_version_number(submission.id) + 1

        comment_json = [
            {
                'id': comment.id,
                'text': comment.text,
                'component_id': comment.component_id,
                'submission_date': str(comment.submission_date) if comment.submission_date else None,
            }
            for comment in comments
        ]

        staff_note_json = [
            {
                'id': note.id,
                'note': note.note,
                'note_type': note.note_type,
            }
            for note in staff_notes
        ]

        version = SubmissionVersion(
            submission_id=submission.id,
            version_number=next_version,
            comment_json=comment_json,
            comment_status_id=submission.comment_status_id,
            reviewed_by=submission.reviewed_by,
            review_date=submission.review_date,
            has_personal_info=submission.has_personal_info,
            has_profanity=submission.has_profanity,
            has_threat=submission.has_threat,
            rejected_reason_other=submission.rejected_reason_other,
            notify_email=submission.notify_email,
            staff_note_json=staff_note_json,
            submission_json=submission.submission_json,
        )

        if session is None:
            db.session.add(version)
            db.session.commit()
        else:
            session.add(version)
            session.flush()

        return version

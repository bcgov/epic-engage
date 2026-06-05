"""Submission Version service.

Provides business logic for submission version operations.
"""
from met_api.models.submission_version import SubmissionVersion
from met_api.schemas.submission_version import SubmissionVersionSchema


class SubmissionVersionService:
    """Service for submission version operations."""

    @classmethod
    def get_by_submission_id(cls, submission_id: int):
        """Get all version snapshots for a submission.

        Args:
            submission_id: The ID of the submission.

        Returns:
            List of serialized version snapshots ordered by version number.
        """
        versions = SubmissionVersion.get_by_submission_id(submission_id)
        return SubmissionVersionSchema(many=True).dump(versions)

    @classmethod
    def get_version_count(cls, submission_id: int) -> int:
        """Get the number of versions for a submission.

        Args:
            submission_id: The ID of the submission.

        Returns:
            The count of version snapshots.
        """
        return SubmissionVersion.get_latest_version_number(submission_id)

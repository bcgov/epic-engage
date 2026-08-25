"""job_run_log model class.

Durable record of every met-cron scheduled job run. Written by met-cron, which keeps its own
copy of this model bound to the analytics database. It is declared here so the service that
owns the schema knows about the table and autogenerate does not offer to drop it.
"""
from datetime import datetime


from .db import db


class JobRunLog(db.Model):  # pylint: disable=too-few-public-methods
    """Definition of the job_run_log entity."""

    __tablename__ = 'job_run_log'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    job_name = db.Column(db.String(100), nullable=False, index=True)
    started_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    finished_at = db.Column(db.DateTime)
    duration_seconds = db.Column(db.Float)
    success = db.Column(db.Boolean)
    error_type = db.Column(db.String(200))
    error_detail = db.Column(db.Text)

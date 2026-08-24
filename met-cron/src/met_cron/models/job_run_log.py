"""job_run_log model class.

Durable record of every met-cron scheduled job run. Lives in the database rather than a
local log file so the history survives a server or pod restart.
"""
from datetime import datetime

from .db import db


class JobRunLog(db.Model):  # pylint: disable=too-few-public-methods
    """Definition of the job_run_log entity."""

    __tablename__ = 'job_run_log'
    __bind_key__ = 'met_db_analytics'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    job_name = db.Column(db.String(100), nullable=False, index=True)
    started_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    finished_at = db.Column(db.DateTime)
    duration_seconds = db.Column(db.Float)
    # Null means the run started and never reported back: the process was killed or the pod died.
    success = db.Column(db.Boolean)
    error_type = db.Column(db.String(200))
    # Redacted traceback. Never write raw exception text here, see met_cron.utils.scrub.
    error_detail = db.Column(db.Text)

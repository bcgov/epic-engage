# Copyright © 2019 Province of British Columbia
#
# Licensed under the Apache License, Version 2.0 (the 'License');
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an 'AS IS' BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Durable run logging for met-cron scheduled jobs."""
import traceback
from contextlib import contextmanager
from datetime import datetime

from flask import current_app

from met_cron.models.db import db
from met_cron.models.job_run_log import JobRunLog
from met_cron.utils.scrub import scrub_sensitive


class JobLogService:  # pylint: disable=too-few-public-methods
    """Record each scheduled job run, including how it failed."""

    @staticmethod
    @contextmanager
    def track(job_name):
        """Write a job_run_log row around the job.

        The exception is re-raised so the caller can still exit non-zero, but it is never
        printed raw: only the redacted traceback reaches the log row and the container log.
        """
        started_at = datetime.utcnow()
        current_app.logger.info('<<<< Starting job %s >>>>', job_name)
        log_id = _never_fail('record job start', JobLogService._record_start, job_name, started_at)
        try:
            yield
        except Exception as exc:  # noqa: B902; every job failure has to be logged
            finished_at = datetime.utcnow()
            duration = (finished_at - started_at).total_seconds()
            error_type = type(exc).__name__
            error_detail = scrub_sensitive(traceback.format_exc(), _error_max_chars())
            current_app.logger.error('<<<< Job %s FAILED after %.1fs with %s >>>>\n%s',
                                     job_name, duration, error_type, error_detail)
            _never_fail('record job failure', JobLogService._record_finish,
                        log_id, finished_at, duration, False, error_type, error_detail)
            raise

        finished_at = datetime.utcnow()
        duration = (finished_at - started_at).total_seconds()
        current_app.logger.info('<<<< Completed job %s in %.1fs >>>>', job_name, duration)
        _never_fail('record job success', JobLogService._record_finish,
                    log_id, finished_at, duration, True, None, None)

    @staticmethod
    def _record_start(job_name, started_at):
        """Commit the in-flight row up front so a killed process still leaves a trace."""
        log = JobRunLog(job_name=job_name, started_at=started_at)
        db.session.add(log)
        db.session.commit()
        return log.id

    @staticmethod
    def _record_finish(log_id, finished_at, duration, success, error_type, error_detail):
        if not success:
            # A failed job usually leaves the session inside a broken transaction.
            db.session.rollback()
        if log_id is None:
            return None
        log = db.session.get(JobRunLog, log_id)
        log.finished_at = finished_at
        log.duration_seconds = duration
        log.success = success
        log.error_type = error_type
        log.error_detail = error_detail
        db.session.commit()
        return log.id


def _error_max_chars():
    return int(current_app.config.get('JOB_LOG_ERROR_MAX_CHARS', 4000))


def _never_fail(action, func, *args):
    """Run func, swallowing anything it raises.

    Logging is observability, not the job. A database that is down must not take a job
    down with it.
    """
    try:
        return func(*args)
    except Exception as exc:  # noqa: B902; observability must never break the job
        current_app.logger.warning('Could not %s: %s: %s', action, type(exc).__name__,
                                   scrub_sensitive(str(exc), _error_max_chars()))
        return None

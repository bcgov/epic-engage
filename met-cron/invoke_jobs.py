# Copyright © 2019 Province of British Columbia
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Generate account statements.

This module will create statement records for each account.
"""
import os
import sys

from flask import Flask
from utils.logger import setup_logging

import config

setup_logging(os.path.join(os.path.abspath(os.path.dirname(__file__)), 'logging.conf'))  # important to do this first


def create_app(run_mode=os.getenv('FLASK_ENV', 'production')):
    """Return a configured Flask App using the Factory method."""
    from met_cron.models import db, ma

    app = Flask(__name__)
    print(f'>>>>> Creating app in run_mode: {run_mode}')
    print(f'>>>>> Creating app in run_mode: {config.CONFIGURATION[run_mode]}')

    app.config.from_object(config.CONFIGURATION[run_mode])
    app.logger.info(f'<<<< Starting Jobs >>>>')
    db.init_app(app)
    ma.init_app(app)

    register_shellcontext(app)

    return app


def register_shellcontext(app):
    """Register shell context objects."""

    def shell_context():
        """Shell context objects."""
        return {
            'app': app
        }  # pragma: no cover

    app.shell_context_processor(shell_context)


def run(job_name):
    from met_cron.services.job_log_service import JobLogService
    from tasks.closing_soon_mailer import EngagementClosingSoonMailer
    from tasks.met_closeout import MetEngagementCloseout
    from tasks.met_publish import MetEngagementPublish
    from tasks.met_purge import MetPurge
    from tasks.met_comment_redact import MetCommentRedact
    from tasks.subscription_mailer import SubscriptionMailer
    application = create_app()

    jobs = {
        'ENGAGEMENT_CLOSEOUT': MetEngagementCloseout.do_closeout,
        'ENGAGEMENT_PUBLISH': MetEngagementPublish.do_publish,
        'PURGE': MetPurge.do_purge,
        'COMMENT_REDACT': MetCommentRedact.do_redact,
        'PUBLISH_EMAIL': SubscriptionMailer.do_email,
        'CLOSING_SOON_EMAIL': EngagementClosingSoonMailer.do_email,
    }

    with application.app_context():
        job = jobs.get(job_name)
        if job is None:
            application.logger.error('No valid args passed.Exiting job without running any ***************')
            sys.exit(1)
        try:
            with JobLogService.track(job_name):
                job()
        except Exception:  # noqa: B902
            # JobLogService already recorded the failure and logged the redacted traceback.
            # Swallowing it here keeps the raw one, which can carry participant data,
            # out of stdout while still failing the run for cron.
            sys.exit(1)


if __name__ == "__main__":
    run(sys.argv[1])


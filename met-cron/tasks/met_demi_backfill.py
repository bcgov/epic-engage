# Copyright © 2026 Province of British Columbia
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
"""Push every engagement linked to an EPIC project to DEMI once, through the normal publish path."""
from flask import current_app
from sqlalchemy import and_, or_

from met_api.constants.engagement_status import Status
from met_api.models import db
from met_api.models.engagement import Engagement as EngagementModel
from met_api.models.engagement_metadata import EngagementMetadataModel
from met_api.services.project_service import ProjectService

PUBLIC_STATUSES = (Status.Published.value, Status.Scheduled.value, Status.Closed.value)
BACKFILL_TARGETS = ('both', 'demi')


class MetDemiBackfill:  # pylint:disable=too-few-public-methods
    """Manual job that re-sends every EPIC-linked engagement to DEMI."""

    @staticmethod
    def _engagement_ids():
        """Return ids of engagements with an EPIC project id that are public, or unpublished after a push."""
        rows = db.session.query(EngagementModel.id) \
            .join(EngagementMetadataModel, EngagementMetadataModel.engagement_id == EngagementModel.id) \
            .filter(EngagementMetadataModel.project_id.isnot(None)) \
            .filter(EngagementMetadataModel.project_id != '') \
            .filter(or_(
                EngagementModel.status_id.in_(PUBLIC_STATUSES),
                # A tracking id means EPIC holds a period, which DEMI must also show as unpublished.
                and_(EngagementModel.status_id == Status.Unpublished.value,
                     EngagementMetadataModel.project_tracking_id.isnot(None),
                     EngagementMetadataModel.project_tracking_id != ''),
            )) \
            .order_by(EngagementModel.id) \
            .all()
        return [row.id for row in rows]

    @classmethod
    def do_backfill(cls):
        """Push each selected engagement, keep going past failures, then fail the run if any failed."""
        target = current_app.config.get('EPIC_SYNC_TARGET')
        if target not in BACKFILL_TARGETS or not current_app.config.get('IS_EAO_ENVIRONMENT'):
            current_app.logger.error('DEMI backfill refused: needs IS_EAO_ENVIRONMENT true and EPIC_SYNC_TARGET '
                                     'both or demi, got EPIC_SYNC_TARGET=%r.', target)
            raise RuntimeError('DEMI backfill refused: EPIC_SYNC_TARGET is not both or demi, '
                               'or IS_EAO_ENVIRONMENT is off')

        engagement_ids = cls._engagement_ids()
        current_app.logger.info('DEMI backfill selected %s engagements.', len(engagement_ids))

        pushed, failed, skipped_notification = [], [], []
        for engagement_id in engagement_ids:
            # DEMI leg only: Eagle already has these periods. Failures are logged inside and never raised.
            result = ProjectService.update_project_info(engagement_id, targets=('demi',))
            if result is None:
                skipped_notification.append(engagement_id)
            else:
                (pushed if result else failed).append(engagement_id)

        current_app.logger.info('DEMI backfill done: selected %s, pushed %s, failed %s %s, skipped_notification %s.',
                                len(engagement_ids), len(pushed), len(failed), failed, len(skipped_notification))
        if failed:
            raise RuntimeError(f'DEMI backfill failed for engagements {failed}')

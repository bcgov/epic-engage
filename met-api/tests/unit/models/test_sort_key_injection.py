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
"""Security tests: sort_key ORDER BY injection.

Verifies that crafted sort_key values cannot alter query results or inject
SQL through the ORDER BY clause.  Each test:
  1. Creates known rows.
  2. Passes a malicious sort_key (SQL expression / subquery).
  3. Asserts the call succeeds (no DB error) and returns the expected rows.
"""
import pytest

from met_api.constants.feedback import FeedbackStatusType
from met_api.models.engagement import Engagement as EngagementModel
from met_api.models.engagement_scope_options import EngagementScopeOptions
from met_api.models.feedback import Feedback as FeedbackModel
from met_api.models.pagination_options import PaginationOptions
from met_api.models.staff_user import StaffUser as StaffUserModel
from met_api.models.survey import Survey as SurveyModel
from met_api.models.survey_search_options import SurveySearchOptions
from tests.utilities.factory_utils import (
    factory_engagement_model,
    factory_feedback_model,
    factory_staff_user_model,
    factory_survey_model,
)

# A sampling of payloads that would trigger error/boolean/timing oracles
# if user input reached text() in ORDER BY.
_INJECTION_PAYLOADS = [
    '(SELECT 1/0)',
    "(CASE WHEN (SELECT current_setting('is_superuser'))='on' THEN id ELSE created_date END)",
    'id; DROP TABLE engagement;--',
    '1=1',
    'pg_sleep(5)',
]


def _pagination(sort_key, sort_order='asc'):
    return PaginationOptions(page=None, size=None, sort_key=sort_key, sort_order=sort_order)


# ---------------------------------------------------------------------------
# Engagement
# ---------------------------------------------------------------------------

class TestEngagementSortKeyInjection:
    """sort_key injection via Engagement.get_engagements_paginated."""

    def _scope(self):
        return EngagementScopeOptions(restricted=False, include_assigned=False, engagement_status_ids=None)

    @pytest.mark.parametrize('payload', _INJECTION_PAYLOADS)
    def test_malicious_sort_key_does_not_raise(self, session, payload):
        """Crafted sort_key must not raise a DB error."""
        factory_engagement_model()
        items, count = EngagementModel.get_engagements_paginated(
            external_user_id=1,
            pagination_options=_pagination(payload),
            scope_options=self._scope(),
        )
        assert count >= 1

    def test_unknown_sort_key_falls_back_to_name(self, session):
        """An unknown sort_key should silently fall back to the default column."""
        factory_engagement_model()
        items, count = EngagementModel.get_engagements_paginated(
            external_user_id=1,
            pagination_options=_pagination('nonexistent_column'),
            scope_options=self._scope(),
        )
        assert count >= 1

    def test_valid_sort_keys_work(self, session):
        """All whitelisted sort keys must produce results without error."""
        factory_engagement_model()
        for key in ('name', 'created_date', 'engagement.created_date',
                    'published_date', 'status_id', 'start_date', 'end_date'):
            items, count = EngagementModel.get_engagements_paginated(
                external_user_id=1,
                pagination_options=_pagination(key),
                scope_options=self._scope(),
            )
            assert count >= 1, f'sort_key={key!r} returned no rows'


# ---------------------------------------------------------------------------
# Survey
# ---------------------------------------------------------------------------

class TestSurveySortKeyInjection:
    """sort_key injection via Survey.get_surveys_paginated."""

    def _search_opts(self, eng_id=None):
        return SurveySearchOptions(
            exclude_hidden=False,
            exclude_template=False,
            can_view_all_engagements=True,
            assigned_engagements=[] if eng_id is None else [eng_id],
        )

    @pytest.mark.parametrize('payload', _INJECTION_PAYLOADS)
    def test_malicious_sort_key_does_not_raise(self, session, payload):
        """Crafted sort_key must not raise a DB error."""
        factory_survey_model()
        _, count = SurveyModel.get_surveys_paginated(
            pagination_options=_pagination(payload),
            survey_search_options=self._search_opts(),
        )
        assert count >= 1

    def test_valid_sort_keys_work(self, session):
        """All whitelisted sort keys must produce results without error."""
        factory_survey_model()
        for key in ('name', 'survey.name', 'created_date', 'survey.created_date'):
            _, count = SurveyModel.get_surveys_paginated(
                pagination_options=_pagination(key),
                survey_search_options=self._search_opts(),
            )
            assert count >= 1, f'sort_key={key!r} returned no rows'


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

class TestFeedbackSortKeyInjection:
    """sort_key injection via Feedback.get_all_paginated."""

    @pytest.mark.parametrize('payload', _INJECTION_PAYLOADS)
    def test_malicious_sort_key_does_not_raise(self, session, payload):
        """Crafted sort_key must not raise a DB error."""
        factory_feedback_model()
        _, count = FeedbackModel.get_all_paginated(
            pagination_options=_pagination(payload),
            status=FeedbackStatusType.Unreviewed,
        )
        assert count >= 1

    def test_unknown_sort_key_falls_back_to_id(self, session):
        """An unknown sort_key should silently fall back to id."""
        factory_feedback_model()
        _, count = FeedbackModel.get_all_paginated(
            pagination_options=_pagination('nonexistent_column'),
            status=FeedbackStatusType.Unreviewed,
        )
        assert count >= 1

    def test_valid_sort_keys_work(self, session):
        """All whitelisted sort keys must produce results without error."""
        factory_feedback_model()
        for key in ('id', 'status', 'rating', 'comment', 'comment_type', 'source'):
            _, count = FeedbackModel.get_all_paginated(
                pagination_options=_pagination(key),
                status=FeedbackStatusType.Unreviewed,
            )
            assert count >= 1, f'sort_key={key!r} returned no rows'


# ---------------------------------------------------------------------------
# StaffUser
# ---------------------------------------------------------------------------

class TestStaffUserSortKeyInjection:
    """sort_key injection via StaffUser.get_all_paginated."""

    @pytest.mark.parametrize('payload', _INJECTION_PAYLOADS)
    def test_malicious_sort_key_does_not_raise(self, session, payload):
        """Crafted sort_key must not raise a DB error."""
        factory_staff_user_model()
        _, count = StaffUserModel.get_all_paginated(
            pagination_options=_pagination(payload),
        )
        assert count >= 1

    def test_valid_sort_keys_work(self, session):
        """All whitelisted sort keys must produce results without error."""
        factory_staff_user_model()
        for key in ('first_name', 'last_name', 'email_address', 'username'):
            _, count = StaffUserModel.get_all_paginated(
                pagination_options=_pagination(key),
            )
            assert count >= 1, f'sort_key={key!r} returned no rows'

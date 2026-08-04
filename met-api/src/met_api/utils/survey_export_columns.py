# Copyright © 2021 Province of British Columbia
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
"""Flatten a survey's form_json into the spreadsheet columns of the dashboard export.

A question becomes one column (Radio, Drop-down) or one per row/option (Likert, Rank order,
Checkbox), so a respondent's whole submission fits on one row. Each column reads its own
answer, since the stored shape differs per type:

    simpleradios / simpleselect  data[key]                 -> option label
    simplesurvey (Likert)        data[key][rowKey]         -> scale code, kept as stored
    simpleranking (Rank order)   data[key][statementId]    -> rank position
    simplecheckboxes             data[key][optionKey]      -> 1 / 0

Free-text questions are excluded.
"""
from typing import NamedTuple, Optional

from met_api.constants.report_setting_type import FormIoComponentType


# Question types that carry quantitative answers.
QUANTITATIVE_TYPES = {
    FormIoComponentType.RADIO.value,
    FormIoComponentType.CHECKBOX.value,
    FormIoComponentType.SELECTLIST.value,
    FormIoComponentType.SURVEY.value,
    FormIoComponentType.RANKING.value,
}

# Types whose answer is a flat value rather than a per-row/per-option mapping.
SINGLE_VALUE_TYPES = {
    FormIoComponentType.RADIO.value,
    FormIoComponentType.SELECTLIST.value,
}


class ExportColumn(NamedTuple):
    """One spreadsheet column: a question, or one row/option of a multi-part question."""

    page_index: int
    page_title: str
    question_key: str
    question_label: str
    # The Likert row, ranking statement or checkbox option this column covers.
    # Empty for Radio and Drop-down, which occupy a single unlabelled column.
    option_label: str
    component_type: str
    # Sub-field of the answer this column reads
    option_key: Optional[str] = None
    # Value code -> display label, single-value types only.
    value_labels: Optional[dict] = None

    def read_answer(self, submission_json: dict):
        """Read this column's answer out of a submission, or None when unanswered.

        None rather than '' so the cell is genuinely blank: Excel counts a zero-length string
        as a value, and it would drag a text type into an otherwise numeric column.
        """
        answer = (submission_json or {}).get(self.question_key)

        if self.component_type in SINGLE_VALUE_TYPES:
            if answer in (None, ''):
                return None
            return (self.value_labels or {}).get(answer, answer)

        if not isinstance(answer, dict):
            # Checkbox alone has a meaningful "not selected", but only once answered.
            return None

        if self.component_type == FormIoComponentType.CHECKBOX.value:
            return 1 if answer.get(self.option_key) else 0

        # Kept as stored so the column stays numeric.
        value = answer.get(self.option_key)
        return None if value in (None, '') else value


def _walk_components(component: dict, found: list):
    """Depth-first collect every component nested under `component`, `component` included."""
    if not isinstance(component, dict):
        return
    if component.get('key'):
        found.append(component)
    for child in component.get('components', []) or []:
        _walk_components(child, found)
    for column in component.get('columns', []) or []:
        _walk_components(column, found)


def value_labels(component: dict) -> dict:
    """Map a component's option value codes to their display labels."""
    return {v.get('value'): v.get('label') for v in component.get('values', []) or []}


def iter_survey_questions(form_json: dict):
    """Yield (page_index, page_title, component) for every quantitative question, in form order.

    Wizard forms keep their page titles; a non-wizard form is treated as a single untitled
    page so callers still have a page to group by.
    """
    form_json = form_json or {}
    top_level = form_json.get('components', []) or []
    is_wizard = form_json.get('display') == 'wizard' and bool(top_level)
    pages = top_level if is_wizard else [{'components': top_level, 'title': ''}]

    for page_index, page in enumerate(pages):
        components = []
        _walk_components(page, components)
        for component in components:
            if component.get('type') in QUANTITATIVE_TYPES:
                yield page_index, page.get('title') or '', component


def _columns_for_component(component: dict, page_index: int, page_title: str) -> list:
    """Expand a single quantitative component into its spreadsheet columns."""
    component_type = component.get('type')
    key = component.get('key')
    label = component.get('label') or key
    shared = {
        'page_index': page_index,
        'page_title': page_title,
        'question_key': key,
        'question_label': label,
        'component_type': component_type,
    }

    if component_type in SINGLE_VALUE_TYPES:
        return [ExportColumn(**shared, option_label='', value_labels=value_labels(component))]

    if component_type == FormIoComponentType.SURVEY.value:
        rows = component.get('questions', []) or []
        return [
            ExportColumn(**shared, option_label=row.get('label') or '', option_key=row.get('value'))
            for row in rows
        ]

    if component_type == FormIoComponentType.RANKING.value:
        statements = component.get('statements', []) or []
        return [
            ExportColumn(**shared, option_label=s.get('label') or '', option_key=s.get('id'))
            for s in statements
        ]

    # Checkbox: one column per option.
    return [
        ExportColumn(**shared, option_label=option.get('label') or '', option_key=option.get('value'))
        for option in component.get('values', []) or []
    ]


def build_export_columns(form_json: dict) -> list:
    """Flatten a survey form into ordered export columns, grouped by the survey's pages."""
    columns = []
    for page_index, page_title, component in iter_survey_questions(form_json):
        columns.extend(_columns_for_component(component, page_index, page_title))
    return columns


def build_respondent_rows(submissions: list) -> list:
    """Reduce submissions to one row per respondent, newest winning.

    A participant's resubmission replaces their earlier one rather than appearing as a second
    respondent. Anonymous submissions have no participant to group on, so each stays its own.
    """
    latest_by_participant = {}
    anonymous = []
    for submission in submissions:
        if submission.participant_id is None:
            anonymous.append(submission)
            continue
        current = latest_by_participant.get(submission.participant_id)
        if current is None or submission.id > current.id:
            latest_by_participant[submission.participant_id] = submission

    # By submission id, so a re-run assigns the same respondent ids.
    return sorted([*latest_by_participant.values(), *anonymous], key=lambda s: s.id)


def format_respondent_id(index: int) -> str:
    """Build the display id for the nth respondent, e.g. 'R-0001'."""
    return f'R-{index + 1:04d}'

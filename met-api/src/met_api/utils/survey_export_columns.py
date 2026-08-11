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
    simpletextarea / textfield   data[key]                 -> the text itself

Callers pick which types they want, so a sheet can take the quantitative questions, the
free-text ones, or both.
"""
from typing import NamedTuple, Optional

from met_api.constants.report_setting_type import FormIoComponentType
from met_api.utils.form_components import iter_pages
from met_api.utils.survey_conditional_logic import extract_conditional_links


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

# Free-text types that carry the qualitative answers
FREE_TEXT_TYPES = {
    FormIoComponentType.TEXTAREA.value,
    FormIoComponentType.TEXTFIELD.value,
}

# Everything answered with one flat value, so one column and no option label.
FLAT_VALUE_TYPES = SINGLE_VALUE_TYPES | FREE_TEXT_TYPES


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

        if self.component_type in FLAT_VALUE_TYPES:
            if answer in (None, ''):
                return None
            # Free text has no option list, so it falls through as the text itself.
            return (self.value_labels or {}).get(answer, answer)

        if not isinstance(answer, dict):
            # Checkbox alone has a meaningful "not selected", but only once answered.
            return None

        if self.component_type == FormIoComponentType.CHECKBOX.value:
            return 1 if answer.get(self.option_key) else 0

        # Kept as stored so the column stays numeric.
        value = answer.get(self.option_key)
        return None if value in (None, '') else value


def value_labels(component: dict) -> dict:
    """Map a component's option value codes to their display labels."""
    return {v.get('value'): v.get('label') for v in component.get('values', []) or []}


def iter_survey_questions(form_json: dict, types: set = None):
    """Yield (page_index, page_title, component) for every matching question, in form order.

    Wizard forms keep their page titles; a non-wizard form is treated as a single untitled
    page so callers still have a page to group by.
    """
    types = QUANTITATIVE_TYPES if types is None else types
    for page_index, (page, components) in enumerate(iter_pages(form_json)):
        for component in components:
            if component.get('type') in types:
                yield page_index, page.get('title') or '', component


def _conditional_qualifier(link: dict) -> str:
    """Name the option or matrix row that triggers a conditional follow-up."""
    if not link:
        return ''
    if link.get('row_label'):
        return link['row_label']
    return ' or '.join(label for label in link.get('trigger_value_labels') or [] if label)


def _columns_for_component(component: dict, page_index: int, page_title: str, qualifier: str) -> list:
    """Expand a single component into its spreadsheet columns."""
    component_type = component.get('type')
    key = component.get('key')
    label = component.get('label') or key
    if qualifier:
        label = f'{label} ({qualifier})'
    shared = {
        'page_index': page_index,
        'page_title': page_title,
        'question_key': key,
        'question_label': label,
        'component_type': component_type,
    }

    if component_type in FLAT_VALUE_TYPES:
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


def build_export_columns(form_json: dict, types: set = None) -> list:
    """Flatten a survey form into ordered export columns, in form order.

    Conditional free-text follow-ups routinely share one label across several questions - one
    per option of the question that triggers them - so the triggering option is appended to
    keep otherwise identical column headers apart.
    """
    links = extract_conditional_links(form_json)
    columns = []
    for page_index, page_title, component in iter_survey_questions(form_json, types):
        qualifier = _conditional_qualifier(links.get(component.get('key')))
        columns.extend(_columns_for_component(component, page_index, page_title, qualifier))
    return columns


def filter_respondents_with_comments(respondents: list, columns: list) -> list:
    """Keep the (index, respondent) pairs that answered at least one free-text question.

    The index is the respondent's position in the full list, so their id stays the same one the
    other sheets show and a reader can cross-reference between them.
    """
    return [
        (index, respondent)
        for index, respondent in enumerate(respondents)
        if any(column.read_answer(respondent.submission_json) for column in columns)
    ]


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

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


class RespondentRow(NamedTuple):
    """One submission, with the respondent identity the export shows for it."""

    submission: object
    # 'R-0001-01': the respondent, then which of their submissions this is.
    respondent_id: str
    # 0-based group of submissions sharing an email, which the shared colour band marks.
    group_index: int
    # How many submissions came from this email, repeated on each of its rows.
    submission_count: int


def filter_respondents_with_comments(respondents: list, columns: list) -> list:
    """Keep the respondents who answered at least one free-text question.

    Each row carries its own id, so dropping the silent respondents cannot shift the ids of the
    ones that remain and a reader can still cross-reference between sheets.
    """
    return [
        respondent
        for respondent in respondents
        if any(column.read_answer(respondent.submission.submission_json) for column in columns)
    ]


def build_respondent_rows(submissions: list) -> list:
    """Expand submissions into one row each, grouped by the email they came from.

    A participant's resubmissions keep their own answers rather than being collapsed into the
    newest one, and share a respondent number so they read as one person: R-0001-01, R-0001-02.
    Anonymous submissions have no participant to group on, so each is its own respondent.

    Groups are ordered by their earliest submission, and each group's rows by submission id, so
    a re-run assigns the same ids and one email's rows always sit together.
    """
    groups = {}
    for submission in submissions:
        # None is not a shared key: each anonymous submission is its own group.
        key = submission.participant_id if submission.participant_id is not None else ('anonymous', submission.id)
        groups.setdefault(key, []).append(submission)

    ordered = sorted(groups.values(), key=lambda group: min(s.id for s in group))

    rows = []
    for group_index, group in enumerate(ordered):
        group = sorted(group, key=lambda s: s.id)
        for sequence, submission in enumerate(group, start=1):
            rows.append(RespondentRow(
                submission=submission,
                respondent_id=format_respondent_id(group_index, sequence),
                group_index=group_index,
                submission_count=len(group),
            ))
    return rows


def format_respondent_id(group_index: int, sequence: int) -> str:
    """Build the display id for a respondent's nth submission, e.g. 'R-0001-01'.

    The sequence is padded too, so a respondent's tenth submission sorts after their second
    rather than between their first and second.
    """
    return f'R-{group_index + 1:04d}-{sequence:02d}'

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
"""Tally a survey's submissions into the rows of the aggregated dashboard export sheet.

One row per selectable option, so the grain differs per question type:

    simpleradios / simpleselect  one row per option
    simplecheckboxes             one row per option
    simplesurvey (Likert)        one row per statement x scale point
    simpleranking (Rank order)   one row per statement x rank position

Every option gets a row even when nobody picked it, so a zero stays visible.

Percentages are fractions, not formatted strings, so the sheet keeps a sortable number.
Their denominator is the respondents who answered that question, not everyone who opened the
survey - a question behind conditional logic is only seen by some. Checkbox percentages
therefore sum past 100%, since one respondent can tick several boxes.
"""
from typing import NamedTuple, Optional

from met_api.constants.report_setting_type import FormIoComponentType
from met_api.utils.survey_export_columns import iter_survey_questions


class AggregateRow(NamedTuple):
    """One row of the aggregated sheet: a single option's tally within its question."""

    page_index: int
    page_title: str
    question_label: str
    component_type: str
    answer_option: str
    count: Optional[int] = None
    percentage: Optional[float] = None
    likert_point: Optional[str] = None
    likert_label: Optional[str] = None
    rank_position: Optional[str] = None
    rank_count: Optional[int] = None
    rank_percentage: Optional[float] = None


def _share(count: int, total: int) -> Optional[float]:
    """Express a count as a fraction of a total, or None when nothing was answered."""
    return count / total if total else None


def _answers_for(submissions: list, question_key: str) -> list:
    """Collect every non-empty answer given to a question."""
    answers = []
    for submission in submissions:
        answer = (submission.submission_json or {}).get(question_key)
        if answer not in (None, '', {}):
            answers.append(answer)
    return answers


def _option_rows(component: dict, submissions: list, shared: dict) -> list:
    """Tally a radio or drop-down: one row per option."""
    answers = _answers_for(submissions, component.get('key'))
    total = len(answers)
    rows = []
    for option in component.get('values', []) or []:
        count = answers.count(option.get('value'))
        rows.append(AggregateRow(
            **shared,
            answer_option=option.get('label') or option.get('value') or '',
            count=count,
            percentage=_share(count, total),
        ))
    return rows


def _checkbox_rows(component: dict, submissions: list, shared: dict) -> list:
    """Tally a checkbox: one row per option, over respondents who answered."""
    answers = [a for a in _answers_for(submissions, component.get('key')) if isinstance(a, dict)]
    total = len(answers)
    rows = []
    for option in component.get('values', []) or []:
        count = sum(1 for answer in answers if answer.get(option.get('value')))
        rows.append(AggregateRow(
            **shared,
            answer_option=option.get('label') or option.get('value') or '',
            count=count,
            percentage=_share(count, total),
        ))
    return rows


def _likert_rows(component: dict, submissions: list, shared: dict) -> list:
    """Tally a Likert matrix: one row per statement and scale point."""
    answers = [a for a in _answers_for(submissions, component.get('key')) if isinstance(a, dict)]
    scale = component.get('values', []) or []
    rows = []
    for statement in component.get('questions', []) or []:
        statement_key = statement.get('value')
        given = [a.get(statement_key) for a in answers if a.get(statement_key) not in (None, '')]
        total = len(given)
        for point in scale:
            count = given.count(point.get('value'))
            rows.append(AggregateRow(
                **shared,
                answer_option=statement.get('label') or statement_key or '',
                count=count,
                percentage=_share(count, total),
                likert_point=point.get('value'),
                likert_label=point.get('label'),
            ))
    return rows


def _ranking_rows(component: dict, submissions: list, shared: dict) -> list:
    """Tally a rank order: one row per statement and rank position.

    Count/percentage stay empty - a ranking reports through its own rank columns, so the two
    tallies are not confused on a sheet that mixes question types.
    """
    answers = [a for a in _answers_for(submissions, component.get('key')) if isinstance(a, dict)]
    statements = component.get('statements', []) or []
    rows = []
    for statement in statements:
        statement_id = statement.get('id')
        given = [a.get(statement_id) for a in answers if a.get(statement_id) not in (None, '')]
        total = len(given)
        # A respondent orders every statement, so positions run 1..n.
        for position in range(1, len(statements) + 1):
            count = sum(1 for rank in given if str(rank) == str(position))
            rows.append(AggregateRow(
                **shared,
                answer_option=statement.get('label') or statement_id or '',
                rank_position=f'Ranked {position}',
                rank_count=count,
                rank_percentage=_share(count, total),
            ))
    return rows


_ROW_BUILDERS = {
    FormIoComponentType.RADIO.value: _option_rows,
    FormIoComponentType.SELECTLIST.value: _option_rows,
    FormIoComponentType.CHECKBOX.value: _checkbox_rows,
    FormIoComponentType.SURVEY.value: _likert_rows,
    FormIoComponentType.RANKING.value: _ranking_rows,
}


def build_aggregate_rows(form_json: dict, submissions: list) -> list:
    """Tally a survey's submissions into aggregated rows, in form order."""
    rows = []
    for page_index, page_title, component in iter_survey_questions(form_json):
        builder = _ROW_BUILDERS.get(component.get('type'))
        if not builder:
            continue
        shared = {
            'page_index': page_index,
            'page_title': page_title,
            'question_label': component.get('label') or component.get('key') or '',
            'component_type': component.get('type'),
        }
        rows.extend(builder(component, submissions, shared))
    return rows

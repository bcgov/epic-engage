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
"""Service for exporting internal dashboard survey data to a spreadsheet.

Builds the sheets the dashboard's data export offers: the quantitative answers per submission
and aggregated, both combined with the free text, the approved free text alone, and a comment
audit carrying every submission's text and review details whatever its status.

Comment text that has not been approved appears only on the Comment Audit sheet, so only
Superusers get it. Team Members of the engagement get the other four sheets.

Every submission gets its own row and its own id. Resubmissions from one email share a
respondent number (R-0001-01, R-0001-02), sit together, and carry a count of how many came from
that email, so repeated submissions meant to skew the results are easy to spot.

An .xlsx rather than a literal .csv: a CSV is one flat text sheet, and cannot carry multiple
sheets, zebra striping or colour coding.
"""
from __future__ import annotations

from copy import copy
from io import BytesIO
import math
import re
from typing import NamedTuple
from weakref import WeakKeyDictionary

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
import pytz

from met_api.constants.comment_status import Status
from met_api.constants.membership_type import MembershipType
from met_api.constants.report_setting_type import FormIoComponentType
from met_api.models.engagement_metadata import EngagementMetadataModel
from met_api.models.submission import Submission as SubmissionModel
from met_api.models.survey import Survey as SurveyModel
from met_api.services import authorization
from met_api.services.comment_service import CommentService
from met_api.utils.datetime import legislative_timezone, utc_datetime
from met_api.utils.export_styles import (
    AGGREGATE_HEADER_DESCRIBE_COLOUR, AGGREGATE_HEADER_LIKERT_COLOUR, AGGREGATE_HEADER_RANK_COLOUR,
    AGGREGATE_HEADER_TALLY_COLOUR, BODY_FONT_COLOUR, CELL_BORDER_COLOUR,
    CHECKBOX_SELECTED_FONT_COLOUR, FONT_NAME, FONT_SIZE, MUTED_FONT_COLOUR, NUMERIC_FONT_COLOUR,
    QUESTION_BANNER_COLOUR, RESPONDENT_FONT_COLOUR, RESPONDENT_HEADER_COLOUR, RESPONDENT_HEADER_FONT_COLOUR,
    RESPONDENT_TYPE_COLOUR, RESPONDENT_TYPE_FONT_COLOUR, get_page_colours,
    get_question_type_colours, get_question_type_label, get_respondent_zebra_colour,
    get_zebra_colour, mute_colour)
from met_api.utils.roles import Role
from met_api.utils.survey_export_aggregates import build_aggregate_rows
from met_api.utils.survey_export_columns import (
    FREE_TEXT_TYPES, QUANTITATIVE_TYPES, build_export_columns, build_respondent_rows,
    filter_respondents_with_comments)
from met_api.utils.token_info import TokenInfo


# Types whose answer is a number rather than an option label
NUMERIC_ANSWER_TYPES = {FormIoComponentType.SURVEY.value, FormIoComponentType.RANKING.value}


class DashboardSheet(NamedTuple):
    """A sheet in the dashboard export workbook."""

    tab_name: str
    # Shown above the table, saying what the sheet holds. A newline starts its note on a new line.
    description: str


QUANTITATIVE_NON_AGGREGATED = DashboardSheet(
    'Quantitative - Non-aggregated',
    'Individual survey responses for all quantitative questions, one row per respondent. '
    'Does not include qualitative comments. Use this tab for detailed cross-comparison analysis '
    'of quantitative data.',
)
QUANTITATIVE_AGGREGATED = DashboardSheet(
    'Quantitative - Aggregated',
    'Survey results for all quantitative questions summarized by answer option. Use this tab to '
    'quickly understand how all respondents answered each quantitative question at a glance.\n'
    'NOTE: Visualizations of these data are available within the internal dashboard on '
    'EPIC.engage.',
)
ALL_DATA = DashboardSheet(
    'All Data',
    'All quantitative and qualitative data in a single view, one row per respondent. Use this tab '
    'to compare and infer trends between quantitative responses (like location, or gender) with '
    "qualitative comments, or to cross-reference a respondent's qualitative comment (e.g. if they "
    'write "see my previous comment").\nNote: Qualitative comments are only visible for approved '
    'submissions; Pending or Rejected comments are not included. Comment status applies to '
    'free-text responses only; quantitative answers are always included regardless of comment '
    'status.',
)
APPROVED_QUALITATIVE = DashboardSheet(
    'Approved Qualitative Responses',
    'All approved qualitative comments. Use this tab to review and analyze approved qualitative '
    "comments.\nNOTE: For internal use only. Use the 'Public/proponent' output option for "
    'sharing with proponents.',
)
COMMENT_AUDIT = DashboardSheet(
    'Comment Audit',
    'Complete record of all qualitative comments received and review status. Some entries may '
    'contain unreviewed or sensitive content - handle with care and follow privacy requirements - '
    'INTERNAL USE ONLY. Use this tab to investigate submission anomalies or analyze comment '
    'review statistics.',
)

DASHBOARD_SHEETS = (
    QUANTITATIVE_NON_AGGREGATED,
    QUANTITATIVE_AGGREGATED,
    ALL_DATA,
    APPROVED_QUALITATIVE,
    COMMENT_AUDIT,
)

# Every sheet opens with its description, then the header rows of its table.
DESCRIPTION_ROW = 1
PAGE_TITLE_ROW = 2
QUESTION_TITLE_ROW = 3
OPTION_LABEL_ROW = 4
QUESTION_TYPE_ROW = 5
DATA_START_ROW = 6
# The description is merged across the table, up to this many columns, and wrapped within them.
DESCRIPTION_COLUMNS = 8
# Excel's width for a column the sheet leaves unset.
DEFAULT_COLUMN_WIDTH = 8.43

# The columns identifying a submission, ahead of any question. Each sheet picks its own, and they
# take the sheet's first columns in the order given.
RESPONDENT_COLUMN = 'respondent_id'
SUBMISSION_COUNT_COLUMN = 'submission_count'
# The submission id the comment review screens label a submission by, so an answer in the export
# can be traced back to the submission it was reviewed under.
COMMENT_ID_COLUMN = 'comment_id'
COMMENT_STATUS_COLUMN = 'comment_status'
REJECTION_REASON_COLUMN = 'rejection_reason'
PUBLISHED_DATE_COLUMN = 'published_date'
REVIEWER_COLUMN = 'reviewer'
PROJECT_COLUMN = 'project'

RESPONDENT_COLUMNS = (RESPONDENT_COLUMN, SUBMISSION_COUNT_COLUMN)
RESPONDENT_COLUMNS_WITH_COMMENT_ID = RESPONDENT_COLUMNS + (COMMENT_ID_COLUMN,)
ALL_DATA_COLUMNS = (RESPONDENT_COLUMN, COMMENT_STATUS_COLUMN, SUBMISSION_COUNT_COLUMN, COMMENT_ID_COLUMN)
COMMENT_AUDIT_COLUMNS = (
    RESPONDENT_COLUMN, COMMENT_STATUS_COLUMN, COMMENT_ID_COLUMN, REJECTION_REASON_COLUMN,
    PUBLISHED_DATE_COLUMN, REVIEWER_COLUMN, PROJECT_COLUMN,
)

QUESTION_COLUMN_WIDTH = 22

IDENTITY_COLUMN_HEADINGS = {
    RESPONDENT_COLUMN: 'Respondent ID',
    SUBMISSION_COUNT_COLUMN: 'Submissions',
    COMMENT_ID_COLUMN: 'Comment ID',
    COMMENT_STATUS_COLUMN: 'Comment Status',
    REJECTION_REASON_COLUMN: 'Reason for Rejection',
    PUBLISHED_DATE_COLUMN: 'Published Date',
    REVIEWER_COLUMN: 'Reviewer',
    PROJECT_COLUMN: 'Project',
}

IDENTITY_COLUMN_WIDTHS = {
    RESPONDENT_COLUMN: 12,
    SUBMISSION_COUNT_COLUMN: 12,
    COMMENT_ID_COLUMN: 12,
    COMMENT_STATUS_COLUMN: 16,
    REJECTION_REASON_COLUMN: 30,
    PUBLISHED_DATE_COLUMN: 18,
    REVIEWER_COLUMN: 20,
    PROJECT_COLUMN: 24,
}

# The heading over the identity columns on the sheets that carry comment status.
IDENTITY_BANNER = 'Data'
PUBLISHED_DATE_FORMAT = 'mmmm d, yyyy'

# The qualitative sheet drops the option and type rows.
COMMENT_DATA_START_ROW = 4
COMMENT_COLUMN_WIDTH = 48

# The aggregated sheet's single header row, then banners and option rows beneath it.
AGGREGATE_HEADER_ROW = 2
AGGREGATE_COLUMN_WIDTH = 24
PERCENTAGE_FORMAT = '0.0%'

# Column headings in order, with the colour of the group each belongs to. The design offset
# these by one against the data; they are aligned here.
AGGREGATE_COLUMNS = (
    ('Question Type', AGGREGATE_HEADER_DESCRIBE_COLOUR),
    ('Question', AGGREGATE_HEADER_DESCRIBE_COLOUR),
    ('Answer Option', AGGREGATE_HEADER_DESCRIBE_COLOUR),
    ('Count', AGGREGATE_HEADER_TALLY_COLOUR),
    ('Percentage', AGGREGATE_HEADER_TALLY_COLOUR),
    ('Likert Matrix Point', AGGREGATE_HEADER_LIKERT_COLOUR),
    ('Likert Matrix Label', AGGREGATE_HEADER_LIKERT_COLOUR),
    ('Rank Position', AGGREGATE_HEADER_RANK_COLOUR),
    ('Rank Count', AGGREGATE_HEADER_RANK_COLOUR),
    ('Rank Percentage', AGGREGATE_HEADER_RANK_COLOUR),
)

# Indexes into AGGREGATE_COLUMNS holding a fraction rather than a plain number.
AGGREGATE_PERCENTAGE_COLUMNS = (4, 9)


def first_question_column(identity_columns: tuple) -> int:
    """Return the column a sheet's questions start in: whatever follows its identity columns."""
    return len(identity_columns) + 1


def comment_status_label(submission) -> str | None:
    """Name a submission's comment status as the review screens show it.

    A resubmission still waiting on review reads as Resubmitted, which the review screens flag
    separately from its Pending status.
    """
    if submission.comment_status_id is None:
        return None
    if submission.comment_status_id == Status.Pending.value and submission.is_resubmission:
        return 'Resubmitted'
    return Status(submission.comment_status_id).name.replace('_', ' ').title()


def is_approved(submission) -> bool:
    """Whether a submission's comments have been approved for viewing."""
    return submission.comment_status_id == Status.Approved.value


_CENTERED = Alignment(horizontal='center', vertical='center', wrap_text=True)
_LEFT = Alignment(horizontal='left', vertical='center')
_WRAPPED_TOP_LEFT = Alignment(horizontal='left', vertical='top', wrap_text=True)
_CELL_EDGE = Side(style='thin', color=CELL_BORDER_COLOUR)
_THIN_BORDER = Border(left=_CELL_EDGE, right=_CELL_EDGE, top=_CELL_EDGE, bottom=_CELL_EDGE)

# The style indexes each combination of fill, font and alignment resolved to, per workbook.
_STYLE_CACHE = WeakKeyDictionary()


def _apply_cell_style(  # pylint: disable=too-many-arguments
    cell, fill: str, font_colour: str, alignment: Alignment, *, bold: bool = False, italic: bool = False,
):
    """Give a cell its fill, font, border and alignment, resolving each combination only once.

    Assigning a style to an openpyxl cell hashes it against every style the workbook already
    holds. Done four times a cell, that was most of the time a large survey's export took, so
    the first cell of each look is styled in full and the rest copy its style indexes.
    """
    cache = _STYLE_CACHE.setdefault(cell.parent.parent, {})
    key = (fill, font_colour, alignment.horizontal, alignment.vertical, alignment.wrap_text, bold, italic)
    style = cache.get(key)
    if style is None:
        cell.fill = PatternFill('solid', fgColor=fill)
        cell.font = Font(color=font_colour, bold=bold, italic=italic, name=FONT_NAME, size=FONT_SIZE)
        cell.border = _THIN_BORDER
        cell.alignment = alignment
        cache[key] = copy(cell._style)  # pylint: disable=protected-access
    else:
        cell._style = copy(style)  # pylint: disable=protected-access
    return cell


class DashboardExportService:  # pylint: disable=too-few-public-methods
    """Dashboard export management service."""

    @classmethod
    def export_dashboard_data_to_spread_sheet(cls, survey_id) -> tuple:
        """Build the internal dashboard export workbook for a survey.

        Returns the workbook as an in-memory byte stream along with a suggested filename.
        """
        survey = SurveyModel.find_by_id(survey_id)
        if not survey:
            raise KeyError(f'Survey with id {survey_id} not found')
        # The Comment Audit sheet holds unreviewed and rejected comment text, so only Superusers
        # get it. The engagement's Team Members get the other sheets, which hold approved text only.
        include_comment_audit = TokenInfo.is_superuser()
        if include_comment_audit:
            one_of_roles = (Role.EXPORT_INTERNAL_COMMENT_SHEET.value,)
        else:
            one_of_roles = (MembershipType.TEAM_MEMBER.name,)
        authorization.check_auth(one_of_roles=one_of_roles, engagement_id=survey.engagement_id)

        workbook = Workbook()

        workbook.remove(workbook.active)

        columns = build_export_columns(survey.form_json, QUANTITATIVE_TYPES)
        all_columns = build_export_columns(survey.form_json, QUANTITATIVE_TYPES | FREE_TEXT_TYPES)
        comment_columns = build_export_columns(survey.form_json, FREE_TEXT_TYPES)
        respondents = build_respondent_rows(SubmissionModel.get_by_survey_id(survey.id))

        for sheet in DASHBOARD_SHEETS:
            if sheet is COMMENT_AUDIT and not include_comment_audit:
                continue
            worksheet = workbook.create_sheet(title=sheet.tab_name)
            if sheet is QUANTITATIVE_NON_AGGREGATED:
                cls._build_non_aggregated_sheet(worksheet, columns, respondents, RESPONDENT_COLUMNS)
            elif sheet is QUANTITATIVE_AGGREGATED:
                # Every submission is tallied, resubmissions included, so the totals agree with
                # the row counts on the other sheets and with the dashboard's own charts.
                cls._build_aggregated_sheet(
                    worksheet,
                    build_aggregate_rows(
                        survey.form_json, [row.submission for row in respondents]
                    ),
                )
            elif sheet is ALL_DATA:
                # Same shape as the non-aggregated sheet, with the free-text columns kept in. Every
                # submission keeps its quantitative answers, but only approved comments show.
                cls._build_non_aggregated_sheet(
                    worksheet, all_columns, respondents, ALL_DATA_COLUMNS,
                    approved_text_only=True, identity_banner=True,
                )
            elif sheet is APPROVED_QUALITATIVE:
                cls._build_qualitative_sheet(
                    worksheet, comment_columns,
                    [row for row in respondents if is_approved(row.submission)],
                    RESPONDENT_COLUMNS_WITH_COMMENT_ID,
                )
            elif sheet is COMMENT_AUDIT:
                # Every submission and all of its text, whatever its status, with how it was reviewed.
                cls._build_non_aggregated_sheet(
                    worksheet, all_columns, respondents, COMMENT_AUDIT_COLUMNS,
                    identity_banner=True, project_name=cls._project_name(survey),
                )
            # Written last, so it can size itself to the column widths the table set.
            cls._write_description(worksheet, sheet.description)

        stream = BytesIO()
        workbook.save(stream)
        stream.seek(0)
        return stream, cls._build_file_name(survey, include_comment_audit)

    @classmethod
    def _build_non_aggregated_sheet(  # pylint: disable=too-many-arguments
        cls, worksheet, columns: list, respondents: list, identity_columns: tuple, *,
        approved_text_only: bool = False, identity_banner: bool = False, project_name: str = None,
    ):
        """Write the one-row-per-respondent sheet: four header rows, then a row per respondent.

        approved_text_only blanks the free text of any submission not yet approved, leaving its
        quantitative answers in place. identity_banner heads the identity columns with 'Data'.
        """
        first_column = first_question_column(identity_columns)
        cls._write_respondent_header(worksheet, identity_columns, identity_banner)
        cls._write_page_banners(worksheet, columns, first_column)
        cls._write_question_headers(worksheet, columns, first_column)
        cls._write_respondent_rows(
            worksheet, columns, respondents, identity_columns,
            approved_text_only=approved_text_only, project_name=project_name,
        )

        cls._set_respondent_column_widths(worksheet, identity_columns)
        for offset, column in enumerate(columns):
            letter = get_column_letter(first_column + offset)
            worksheet.column_dimensions[letter].width = (
                COMMENT_COLUMN_WIDTH if column.component_type in FREE_TEXT_TYPES
                else QUESTION_COLUMN_WIDTH
            )
        # Keep the header in view while scrolling. Columns stay unfrozen so the description can
        # merge across them.
        worksheet.freeze_panes = worksheet.cell(row=DATA_START_ROW, column=1)

    @classmethod
    def _build_aggregated_sheet(cls, worksheet, rows: list):
        """Write the one-row-per-option sheet, banner-separated by page and by question."""
        for index, (label, colour) in enumerate(AGGREGATE_COLUMNS):
            cls._style_header_cell(
                worksheet.cell(row=AGGREGATE_HEADER_ROW, column=index + 1, value=label),
                fill=colour,
                font_colour='FFFFFF',
                bold=True,
            )
            worksheet.column_dimensions[get_column_letter(index + 1)].width = AGGREGATE_COLUMN_WIDTH

        row_number = AGGREGATE_HEADER_ROW + 1
        current_page = None
        current_question = None
        striped_index = 0

        for entry in rows:
            if entry.page_index != current_page:
                current_page = entry.page_index
                current_question = None
                title = f'Page {entry.page_index + 1}'
                if entry.page_title:
                    title = f'{title} - {entry.page_title}'
                cls._write_aggregate_banner(
                    worksheet, row_number, title.upper(),
                    get_page_colours(entry.page_index).banner, 'FFFFFF',
                )
                row_number += 1
            if entry.question_label != current_question:
                current_question = entry.question_label
                cls._write_aggregate_banner(
                    worksheet, row_number, entry.question_label,
                    QUESTION_BANNER_COLOUR, BODY_FONT_COLOUR,
                )
                row_number += 1
                # Restarted per question so every block reads the same way.
                striped_index = 0

            cls._write_aggregate_row(worksheet, row_number, entry, striped_index)
            row_number += 1
            striped_index += 1

        worksheet.freeze_panes = worksheet.cell(row=AGGREGATE_HEADER_ROW + 1, column=1)

    @classmethod
    def _build_qualitative_sheet(
        cls, worksheet, columns: list, respondents: list, identity_columns: tuple
    ):
        """Write the free-text sheet: page banners, question titles, then a row per commenter.

        Pages holding no free-text question simply do not appear, but the page numbers of those
        that do are left alone, so a banner can read "Page 5" with no Page 4 before it.
        """
        if not columns:
            return

        first_column = first_question_column(identity_columns)
        for row in (PAGE_TITLE_ROW, QUESTION_TITLE_ROW):
            for column in range(1, first_column):
                cls._style_header_cell(
                    worksheet.cell(row=row, column=column),
                    fill=RESPONDENT_HEADER_COLOUR,
                    font_colour=RESPONDENT_HEADER_FONT_COLOUR,
                    bold=True,
                )
        cls._write_identity_headings(worksheet, identity_columns)
        cls._set_respondent_column_widths(worksheet, identity_columns)

        cls._write_page_banners(worksheet, columns, first_column)
        for offset, column in enumerate(columns):
            index = first_column + offset
            cls._style_header_cell(
                worksheet.cell(row=QUESTION_TITLE_ROW, column=index, value=column.question_label),
                fill=get_page_colours(column.page_index).header,
                font_colour='FFFFFF',
                bold=True,
            )
            worksheet.column_dimensions[get_column_letter(index)].width = COMMENT_COLUMN_WIDTH

        commenters = filter_respondents_with_comments(respondents, columns)
        for row_index, respondent in enumerate(commenters):
            row = COMMENT_DATA_START_ROW + row_index
            cls._write_identity_cells(worksheet, row, respondent, identity_columns)
            for offset, column in enumerate(columns):
                answer = column.read_answer(respondent.submission.submission_json)
                band = get_zebra_colour(column.page_index, row_index)
                cls._style_data_cell(
                    worksheet.cell(row=row, column=first_column + offset, value=answer),
                    fill=band if answer is not None else mute_colour(band),
                    font_colour=BODY_FONT_COLOUR if answer is not None else MUTED_FONT_COLOUR,
                )

        worksheet.freeze_panes = worksheet.cell(row=COMMENT_DATA_START_ROW, column=1)

    @classmethod
    def _write_aggregate_banner(cls, worksheet, row: int, text: str, fill: str, font_colour: str):
        """Write a full-width banner row, left aligned so long titles stay readable."""
        cell = worksheet.cell(row=row, column=1, value=text)
        cell.fill = PatternFill('solid', fgColor=fill)
        cell.font = Font(color=font_colour, bold=True, name=FONT_NAME, size=FONT_SIZE)
        cell.border = _THIN_BORDER
        cell.alignment = _LEFT
        worksheet.merge_cells(
            start_row=row, start_column=1, end_row=row, end_column=len(AGGREGATE_COLUMNS)
        )
        # merge_cells styles only the top-left cell; fill the rest to keep a solid bar.
        for column in range(2, len(AGGREGATE_COLUMNS) + 1):
            filler = worksheet.cell(row=row, column=column)
            filler.fill = PatternFill('solid', fgColor=fill)
            filler.border = _THIN_BORDER

    @classmethod
    def _write_aggregate_row(cls, worksheet, row: int, entry, striped_index: int):
        """Write one option's tally, banded in its page's colours."""
        band = get_zebra_colour(entry.page_index, striped_index)
        values = (
            get_question_type_label(entry.component_type),
            entry.question_label,
            entry.answer_option,
            entry.count,
            entry.percentage,
            entry.likert_point,
            entry.likert_label,
            entry.rank_position,
            entry.rank_count,
            entry.rank_percentage,
        )
        for index, value in enumerate(values):
            cell = worksheet.cell(row=row, column=index + 1, value=value)
            cls._style_data_cell(
                cell,
                fill=band,
                font_colour=BODY_FONT_COLOUR if value is not None else MUTED_FONT_COLOUR,
            )
            if index in AGGREGATE_PERCENTAGE_COLUMNS:
                # A fraction underneath, so the % stays sortable.
                cell.number_format = PERCENTAGE_FORMAT

    @classmethod
    def _write_respondent_header(cls, worksheet, identity_columns: tuple, identity_banner: bool = False):
        """Write the respondent columns' headers, kept neutral as they belong to no page."""
        last_column = len(identity_columns)
        for row in (PAGE_TITLE_ROW, QUESTION_TITLE_ROW, OPTION_LABEL_ROW):
            for column in range(1, last_column + 1):
                cls._style_header_cell(
                    worksheet.cell(row=row, column=column),
                    fill=RESPONDENT_HEADER_COLOUR,
                    font_colour=RESPONDENT_HEADER_FONT_COLOUR,
                    bold=True,
                )
        cls._write_identity_headings(worksheet, identity_columns)
        if identity_banner:
            # Sits in the page banner row, as a heading over the identity columns.
            worksheet.cell(row=PAGE_TITLE_ROW, column=1, value=IDENTITY_BANNER)
            if last_column > 1:
                worksheet.merge_cells(
                    start_row=PAGE_TITLE_ROW, start_column=1, end_row=PAGE_TITLE_ROW, end_column=last_column
                )
        # Only the id column names the type row; the others just carry the band across.
        for column in range(1, last_column + 1):
            cls._style_header_cell(
                worksheet.cell(
                    row=QUESTION_TYPE_ROW,
                    column=column,
                    value='TYPE' if column == 1 else None,
                ),
                fill=RESPONDENT_TYPE_COLOUR,
                font_colour=RESPONDENT_TYPE_FONT_COLOUR,
                bold=True,
            )

    @classmethod
    def _write_page_banners(cls, worksheet, columns: list, first_column: int):
        """Write row 1: one merged, page-coloured banner spanning each page's columns."""
        for page_index, start, end in cls._page_spans(columns, first_column):
            colours = get_page_colours(page_index)
            title = f'Page {page_index + 1}'
            page_title = columns[start - first_column].page_title
            if page_title:
                title = f'{title} - {page_title}'

            cls._style_header_cell(
                worksheet.cell(row=PAGE_TITLE_ROW, column=start, value=title),
                fill=colours.banner,
                font_colour='FFFFFF',
                bold=True,
            )
            if end > start:
                worksheet.merge_cells(
                    start_row=PAGE_TITLE_ROW, start_column=start, end_row=PAGE_TITLE_ROW, end_column=end
                )
                for column in range(start + 1, end + 1):
                    cls._style_header_cell(
                        worksheet.cell(row=PAGE_TITLE_ROW, column=column),
                        fill=colours.banner,
                        font_colour='FFFFFF',
                    )

    @classmethod
    def _write_question_headers(cls, worksheet, columns: list, first_column: int):
        """Write rows 2-4: question title, option label and question type per column."""
        for offset, column in enumerate(columns):
            index = first_column + offset
            colours = get_page_colours(column.page_index)

            cls._style_header_cell(
                worksheet.cell(row=QUESTION_TITLE_ROW, column=index, value=column.question_label),
                fill=colours.header,
                font_colour='FFFFFF',
                bold=True,
            )
            cls._style_header_cell(
                worksheet.cell(row=OPTION_LABEL_ROW, column=index, value=column.option_label or None),
                fill=colours.header,
                font_colour='FFFFFF',
                italic=True,
            )
            type_fill, type_font = get_question_type_colours(column.component_type)
            cls._style_header_cell(
                worksheet.cell(
                    row=QUESTION_TYPE_ROW,
                    column=index,
                    value=get_question_type_label(column.component_type),
                ),
                fill=type_fill,
                font_colour=type_font,
                bold=True,
            )

    @classmethod
    def _write_identity_cells(
        cls, worksheet, row: int, respondent, identity_columns: tuple, project_name: str = None
    ):
        """Write the columns identifying a submission, banded per email rather than per row.

        Every submission from one email shares a band, so a group of them reads as a single
        block and a reviewer can see at a glance that they came from the same person.
        """
        submission = respondent.submission
        values = {
            RESPONDENT_COLUMN: respondent.respondent_id,
            SUBMISSION_COUNT_COLUMN: respondent.submission_count,
            COMMENT_ID_COLUMN: submission.id,
            COMMENT_STATUS_COLUMN: comment_status_label(submission),
            REJECTION_REASON_COLUMN: cls._rejection_reason(submission),
            PUBLISHED_DATE_COLUMN: cls._published_date(submission),
            REVIEWER_COLUMN: submission.reviewed_by,
            PROJECT_COLUMN: project_name,
        }
        for column, key in enumerate(identity_columns, start=1):
            cell = cls._style_data_cell(
                worksheet.cell(row=row, column=column, value=values[key] or None),
                fill=get_respondent_zebra_colour(respondent.group_index),
                font_colour=RESPONDENT_FONT_COLOUR,
            )
            if key == PUBLISHED_DATE_COLUMN:
                cell.number_format = PUBLISHED_DATE_FORMAT

    @classmethod
    def _write_respondent_rows(  # pylint: disable=too-many-arguments
        cls, worksheet, columns: list, respondents: list, identity_columns: tuple, *,
        approved_text_only: bool = False, project_name: str = None,
    ):
        """Write one row per submission, zebra striped in their page's two band colours."""
        first_column = first_question_column(identity_columns)
        for row_index, respondent in enumerate(respondents):
            row = DATA_START_ROW + row_index

            cls._write_identity_cells(worksheet, row, respondent, identity_columns, project_name)
            for offset, column in enumerate(columns):
                answer = cls._read_answer(column, respondent.submission, approved_text_only)
                band = get_zebra_colour(column.page_index, row_index)
                cls._style_data_cell(
                    worksheet.cell(row=row, column=first_column + offset, value=answer),
                    fill=band if answer is not None else mute_colour(band),
                    font_colour=cls._answer_font_colour(column, answer),
                )

    @staticmethod
    def _read_answer(column, submission, approved_text_only: bool):
        """Read a submission's answer for a column, holding back free text not yet approved."""
        if approved_text_only and column.component_type in FREE_TEXT_TYPES and not is_approved(submission):
            return None
        return column.read_answer(submission.submission_json)

    @staticmethod
    def _write_identity_headings(worksheet, identity_columns: tuple):
        """Name each identity column in the question title row."""
        for column, key in enumerate(identity_columns, start=1):
            worksheet.cell(row=QUESTION_TITLE_ROW, column=column, value=IDENTITY_COLUMN_HEADINGS[key])

    @staticmethod
    def _rejection_reason(submission) -> str | None:
        """List why a submission was rejected; nothing unless it is currently Rejected."""
        if submission.comment_status_id != Status.Rejected.value:
            return None
        return CommentService.get_rejection_note({
            'has_personal_info': submission.has_personal_info,
            'has_profanity': submission.has_profanity,
            'has_threat': submission.has_threat,
            'rejected_reason_other': submission.rejected_reason_other,
        })

    @staticmethod
    def _published_date(submission):
        """Return the date the submission was reviewed, in Pacific time, or None if never."""
        if not submission.review_date:
            return None
        return submission.review_date.replace(tzinfo=pytz.utc).astimezone(legislative_timezone()).date()

    @staticmethod
    def _project_name(survey: SurveyModel) -> str | None:
        """Return the project the survey's engagement is for, from its metadata."""
        metadata = EngagementMetadataModel.find_by_id(survey.engagement_id)
        return (metadata.project_metadata or {}).get('project_name') if metadata else None

    @staticmethod
    def _write_description(worksheet, description: str):
        """Write the sheet's description above its table, merged across and wrapped to fit."""
        cell = worksheet.cell(row=DESCRIPTION_ROW, column=1, value=description)
        cell.font = Font(color=BODY_FONT_COLOUR, italic=True, name=FONT_NAME, size=FONT_SIZE)
        cell.alignment = _WRAPPED_TOP_LEFT
        end_column = min(worksheet.max_column, DESCRIPTION_COLUMNS)
        if end_column > 1:
            worksheet.merge_cells(
                start_row=DESCRIPTION_ROW, start_column=1,
                end_row=DESCRIPTION_ROW, end_column=end_column,
            )
        # Excel won't fit a merged row's height to its text, so estimate it.
        # ponytail: a column width is about one character, so lines are approximate; measure the
        # font if the text gets clipped or leaves big gaps.
        width = sum(
            worksheet.column_dimensions[letter].width
            if letter in worksheet.column_dimensions else DEFAULT_COLUMN_WIDTH
            for letter in map(get_column_letter, range(1, end_column + 1))
        )
        lines = sum(math.ceil(len(line) / width) or 1 for line in description.split('\n'))
        worksheet.row_dimensions[DESCRIPTION_ROW].height = lines * FONT_SIZE * 1.5

    @staticmethod
    def _answer_font_colour(column, answer) -> str:
        """Pick an answer cell's text colour from what it holds."""
        if answer is None:
            return MUTED_FONT_COLOUR
        if column.component_type == FormIoComponentType.CHECKBOX.value:
            return CHECKBOX_SELECTED_FONT_COLOUR if answer else MUTED_FONT_COLOUR
        if column.component_type in NUMERIC_ANSWER_TYPES:
            return NUMERIC_FONT_COLOUR
        return BODY_FONT_COLOUR

    @staticmethod
    def _set_respondent_column_widths(worksheet, identity_columns: tuple):
        """Size the identity columns, shared by every sheet that lists respondents."""
        for column, key in enumerate(identity_columns, start=1):
            worksheet.column_dimensions[get_column_letter(column)].width = IDENTITY_COLUMN_WIDTHS[key]

    @staticmethod
    def _page_spans(columns: list, first_column: int) -> list:
        """Group consecutive columns by page into (page_index, first_column, last_column)."""
        spans = []
        for offset, column in enumerate(columns):
            index = first_column + offset
            if spans and spans[-1][0] == column.page_index:
                spans[-1][2] = index
            else:
                spans.append([column.page_index, index, index])
        return [tuple(span) for span in spans]

    @staticmethod
    def _style_header_cell(cell, fill: str, font_colour: str, bold: bool = False, italic: bool = False):
        """Style a cell in the header block. Every header row is centered."""
        return _apply_cell_style(cell, fill, font_colour, _CENTERED, bold=bold, italic=italic)

    @staticmethod
    def _style_data_cell(cell, fill: str, font_colour: str):
        """Style a respondent's answer cell, left aligned so long labels stay readable."""
        return _apply_cell_style(cell, fill, font_colour, _LEFT)

    @staticmethod
    def _build_file_name(survey: SurveyModel, include_comment_audit: bool) -> str:
        """Build the download filename, e.g. INTERNAL_BigRanch_SuperuserSurveyData_2026-10-09.xlsx.

        The engagement name keeps letters and digits only, as the chart downloads do. Date only,
        in UTC: a time separator would be a colon, invalid in Windows filenames.
        The web client builds the same name for the file it saves.
        """
        engagement_name = survey.engagement.name if survey.engagement else survey.name
        slug = re.sub(r'[^A-Za-z0-9]', '', engagement_name or '') or 'Engagement'
        audience = 'Superuser' if include_comment_audit else 'TeamMember'
        timestamp = utc_datetime().strftime('%Y-%m-%d')
        return f'INTERNAL_{slug}_{audience}SurveyData_{timestamp}.xlsx'

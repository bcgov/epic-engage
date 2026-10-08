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
"""Service for the Public/Proponent comment export.

A spreadsheet of approved comments that is safe to share with the public and the project's
proponents, who answer each comment in the column beside it. Comments are grouped by question,
and questions by their survey page, in form order.

Only free-text questions shown in the public report and switched on for the export are listed.
Every such question is listed even before it has an approved comment, so the sheet can be
shared as comments come in.
"""
from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

from met_api.constants.membership_type import MembershipType
from met_api.models.comment import Comment as CommentModel
from met_api.models.report_setting import ReportSetting as ReportSettingModel
from met_api.models.survey import Survey as SurveyModel
from met_api.services import authorization
from met_api.utils.datetime import utc_datetime
from met_api.utils.export_styles import BODY_FONT_COLOUR, CELL_BORDER_COLOUR, MUTED_FONT_COLOUR
from met_api.utils.roles import Role
from met_api.utils.survey_export_columns import FREE_TEXT_TYPES, build_export_columns


AWAITING_RESPONSE = '- awaiting response -'
NO_COMMENTS = 'No approved comments yet'
COLUMN_HEADINGS = ('Public Comment', 'Proponent Response')

COMMENT_HEADER_COLOUR = '5A6473'
RESPONSE_HEADER_COLOUR = '006064'
HEADER_FONT_COLOUR = 'FFFFFF'
PAGE_BANNER_COLOUR = '1A3A6B'
QUESTION_BANNER_COLOUR = 'E3EEF9'
QUESTION_FONT_COLOUR = '013366'
COMMENT_FILL_COLOUR = 'F0F4FB'
RESPONSE_FILL_COLOUR = 'F0FAFA'
RESPONSE_BORDER_COLOUR = 'B2DFDB'

COMMENT_COLUMN_WIDTH = 120

FONT_NAME = 'Noto Sans'
TITLE_FONT_SIZE = 13
PAGE_FONT_SIZE = 10
HEADING_FONT_SIZE = 9
BODY_FONT_SIZE = 10
RESPONSE_COLUMN_WIDTH = 90

_WRAP = Alignment(horizontal='left', vertical='top', wrap_text=True)


def _border(colour: str) -> Border:
    edge = Side(style='thin', color=colour)
    return Border(left=edge, right=edge, top=edge, bottom=edge)


def _font(size: int, **kwargs) -> Font:
    return Font(name=FONT_NAME, size=size, **kwargs)


def _set_text(cell, value: str):
    """Write text as plain text, whatever it holds.

    Comments come from the public: one starting with '=' would otherwise become a live formula,
    and a control character Excel cannot store would fail the whole export.
    """
    cell.value = ILLEGAL_CHARACTERS_RE.sub('', value)
    cell.data_type = 's'


def _fill(colour: str) -> PatternFill:
    return PatternFill(start_color=colour, end_color=colour, fill_type='solid')


class ProponentExportService:  # pylint: disable=too-few-public-methods
    """Public/Proponent comment export service."""

    @classmethod
    def export_comments_to_spread_sheet(cls, survey_id) -> tuple:
        """Build the Public/Proponent comment export for a survey.

        Returns the workbook as an in-memory byte stream along with a suggested filename.
        """
        survey = SurveyModel.find_by_id(survey_id)
        if not survey:
            raise KeyError(f'Survey with id {survey_id} not found')
        one_of_roles = (
            MembershipType.TEAM_MEMBER.name,
            Role.VIEW_PRIVATE_ENGAGEMENTS.value
        )
        authorization.check_auth(one_of_roles=one_of_roles, engagement_id=survey.engagement_id)

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = 'Public Proponent Export'
        cls._write_sheet(sheet, survey)

        stream = BytesIO()
        workbook.save(stream)
        stream.seek(0)
        return stream, cls._build_file_name(survey)

    @classmethod
    def _write_sheet(cls, sheet, survey: SurveyModel):
        settings = {
            setting.question_key: setting
            for setting in ReportSettingModel.find_by_survey_id(survey.id)
            if setting.display and setting.export_display
        }
        comments_by_question = {}
        for comment in CommentModel.get_proponent_export_comments_by_survey_id(survey.id):
            comments_by_question.setdefault(comment.component_id, []).append(comment.text)

        cls._write_header(sheet, survey)
        current_page = None
        for column in build_export_columns(survey.form_json, FREE_TEXT_TYPES):
            setting = settings.get(column.question_key)
            if not setting:
                continue
            if column.page_index != current_page:
                current_page = column.page_index
                page_label = f'Page {column.page_index + 1}'
                if column.page_title:
                    page_label = f'{page_label} - {column.page_title}'
                cls._write_banner(sheet, page_label.upper(), PAGE_BANNER_COLOUR,
                                  _font(PAGE_FONT_SIZE, bold=True, color=HEADER_FONT_COLOUR))
            cls._write_question(sheet, column.question_label, setting,
                                comments_by_question.get(column.question_key, []))

    @staticmethod
    def _write_header(sheet, survey: SurveyModel):
        """Write the title and the column headings, and freeze them in place."""
        sheet.column_dimensions['A'].width = COMMENT_COLUMN_WIDTH
        sheet.column_dimensions['B'].width = RESPONSE_COLUMN_WIDTH
        title = sheet.cell(row=1, column=1)
        _set_text(title, f'{survey.name} - Public / Proponent Export')
        title.font = _font(TITLE_FONT_SIZE, bold=True)
        sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=2)
        for column, (heading, colour) in enumerate(zip(COLUMN_HEADINGS,
                                                       (COMMENT_HEADER_COLOUR, RESPONSE_HEADER_COLOUR)), start=1):
            cell = sheet.cell(row=2, column=column, value=heading)
            cell.fill = _fill(colour)
            cell.font = _font(HEADING_FONT_SIZE, bold=True, color=HEADER_FONT_COLOUR)
        sheet.freeze_panes = 'A3'

    @classmethod
    def _write_question(cls, sheet, label: str, setting: ReportSettingModel, comments: list):
        """Write a question, its description and its comments, or a notice that it has none yet."""
        cls._write_banner(sheet, label, QUESTION_BANNER_COLOUR,
                          _font(HEADING_FONT_SIZE, bold=True, color=QUESTION_FONT_COLOUR))
        # An export description left unset follows the report's; one cleared on purpose is ''.
        description = setting.export_description
        if description is None:
            description = setting.description
        if description:
            cls._write_banner(sheet, description, QUESTION_BANNER_COLOUR,
                              _font(HEADING_FONT_SIZE, italic=True, color=QUESTION_FONT_COLOUR))
        if not comments:
            cls._write_banner(sheet, NO_COMMENTS, None, _font(BODY_FONT_SIZE, italic=True, color=MUTED_FONT_COLOUR))
        for text in comments:
            cls._write_comment_row(sheet, text)

    @staticmethod
    def _write_banner(sheet, value: str, colour, font: Font):
        """Write a full-width row: a page, a question, its description or its empty notice."""
        row = sheet.max_row + 1
        cell = sheet.cell(row=row, column=1)
        _set_text(cell, value)
        sheet.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
        cell.font = font
        cell.alignment = _WRAP
        if colour:
            cell.fill = _fill(colour)

    @staticmethod
    def _write_comment_row(sheet, text: str):
        row = sheet.max_row + 1
        comment = sheet.cell(row=row, column=1)
        _set_text(comment, text)
        comment.fill = _fill(COMMENT_FILL_COLOUR)
        comment.font = _font(BODY_FONT_SIZE, color=BODY_FONT_COLOUR)
        comment.border = _border(CELL_BORDER_COLOUR)
        comment.alignment = _WRAP
        response = sheet.cell(row=row, column=2, value=AWAITING_RESPONSE)
        response.fill = _fill(RESPONSE_FILL_COLOUR)
        response.font = _font(BODY_FONT_SIZE, italic=True, color=MUTED_FONT_COLOUR)
        response.border = _border(RESPONSE_BORDER_COLOUR)
        response.alignment = _WRAP

    @staticmethod
    def _build_file_name(survey: SurveyModel) -> str:
        """Build the download filename, dated in UTC. The web client builds the same name."""
        engagement_name = survey.engagement.name if survey.engagement else survey.name
        timestamp = utc_datetime().strftime('%Y-%m-%d')
        return f'{engagement_name} - Public Proponent Export - {timestamp}.xlsx'

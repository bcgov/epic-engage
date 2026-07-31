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

Produces a single workbook containing the four sheets the internal dashboard's
"CSV Data Export" option offers. The sheets are created and labelled here; populating
each one with data is handled by its own follow-up ticket, so they currently contain
only their title banner.

Note the export is a `.xlsx` workbook rather than a literal `.csv` file: a CSV is a single
flat text sheet and cannot carry multiple sheets, per-page zebra striping or question type
colour coding, all of which the export requires. The dashboard menu item stays labelled
"CSV Data Export" for the user.
"""
from __future__ import annotations

from io import BytesIO
from typing import NamedTuple

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from met_api.models.survey import Survey as SurveyModel
from met_api.utils.datetime import utc_datetime
from met_api.utils.export_styles import SHEET_TITLE_COLOUR, SHEET_TITLE_FONT_COLOUR


# Excel caps sheet tab names at 31 characters, which "All Data (Quantitative and
# Qualitative)" exceeds, so each sheet carries a short tab name plus its full title written
# into the title banner in row 1.
class DashboardSheet(NamedTuple):
    """A sheet in the dashboard export workbook."""

    tab_name: str
    title: str


QUANTITATIVE_NON_AGGREGATED = DashboardSheet('Quantitative - Non-agg', 'Quantitative - Non-aggregated')
QUANTITATIVE_AGGREGATED = DashboardSheet('Quantitative - Aggregated', 'Quantitative - Aggregated')
ALL_DATA = DashboardSheet('All Data', 'All Data (Quantitative and Qualitative)')
QUALITATIVE_RESPONSES = DashboardSheet('Qualitative Responses', 'Qualitative Responses')

DASHBOARD_SHEETS = (
    QUANTITATIVE_NON_AGGREGATED,
    QUANTITATIVE_AGGREGATED,
    ALL_DATA,
    QUALITATIVE_RESPONSES,
)

# Columns the title banner is merged across, so the title stays readable before any data
# columns exist.
TITLE_BANNER_WIDTH = 8
TITLE_ROW = 1
# Row the sheet builders should start writing content on, leaving a blank spacer row under
# the title banner.
CONTENT_START_ROW = 3


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

        workbook = Workbook()
        # A new workbook comes with one blank default sheet; the first export sheet takes
        # its place rather than leaving it behind.
        workbook.remove(workbook.active)

        for sheet in DASHBOARD_SHEETS:
            cls._create_sheet(workbook, sheet)

        stream = BytesIO()
        workbook.save(stream)
        stream.seek(0)
        return stream, cls._build_file_name(survey)

    @classmethod
    def _create_sheet(cls, workbook: Workbook, sheet: DashboardSheet):
        """Add a titled, empty sheet to the workbook."""
        worksheet = workbook.create_sheet(title=sheet.tab_name)

        title_cell = worksheet.cell(row=TITLE_ROW, column=1, value=sheet.title)
        title_cell.font = Font(bold=True, size=14, color=SHEET_TITLE_FONT_COLOUR)
        title_cell.fill = PatternFill('solid', fgColor=SHEET_TITLE_COLOUR)
        title_cell.alignment = Alignment(vertical='center')
        worksheet.merge_cells(
            start_row=TITLE_ROW, start_column=1, end_row=TITLE_ROW, end_column=TITLE_BANNER_WIDTH
        )
        # merge_cells only styles the top-left cell, so the rest of the banner is filled
        # explicitly to keep it a solid bar.
        for column in range(2, TITLE_BANNER_WIDTH + 1):
            worksheet.cell(row=TITLE_ROW, column=column).fill = PatternFill(
                'solid', fgColor=SHEET_TITLE_COLOUR
            )
        worksheet.row_dimensions[TITLE_ROW].height = 26

        for column in range(1, TITLE_BANNER_WIDTH + 1):
            worksheet.column_dimensions[get_column_letter(column)].width = 28

        # Data rows start below the title banner, so freeze it in place for long sheets.
        worksheet.freeze_panes = worksheet.cell(row=CONTENT_START_ROW, column=1)
        return worksheet

    @staticmethod
    def _build_file_name(survey: SurveyModel) -> str:
        """Build the download filename for a survey's dashboard export.

        Date only, in UTC: the time separator would be a colon, which is not a valid filename
        character on Windows. The web client builds the same name for the file it saves.
        """
        engagement_name = survey.engagement.name if survey.engagement else survey.name
        timestamp = utc_datetime().strftime('%Y-%m-%d')
        return f'INTERNAL ONLY - {engagement_name} - Dashboard Data - {timestamp}.xlsx'

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
"""Colour palette for the dashboard spreadsheet export.

Cells are colour-coded by survey page (four shades each) and by question type. Values come
from the approved export design, and live here so every sheet builder styles rows the same.
"""
from typing import NamedTuple

from met_api.constants.report_setting_type import FormIoComponentType


class PageColours(NamedTuple):
    """The four shades a single survey page is rendered in."""

    banner: str  # page title row
    header: str  # question title / option label rows
    band_light: str  # odd data rows
    band_dark: str  # even data rows


PAGE_COLOURS = (
    PageColours('1A3A6B', '254E8F', 'F0F4FB', 'E2E9F5'),  # blue
    PageColours('1A5C35', '227A47', 'EEF7F1', 'DFF0E3'),  # green
    PageColours('7A4800', '9A5C00', 'FDF5EA', 'F7E9D4'),  # amber
    PageColours('4A1A8C', '6030A8', 'F4EEFB', 'E9DEF5'),  # purple
    PageColours('7A1A1A', '9A3030', 'FBEEEE', 'F5DCDC'),  # red
    PageColours('006064', '007B80', 'EBF7F8', 'D9EFF1'),  # teal
    PageColours('4A3000', '6A4800', 'FBF5EA', 'F5E8D3'),  # brown
    PageColours('1A4A3A', '236B52', 'EBF7F3', 'D8EFE4'),  # forest
)

# Respondent id column
RESPONDENT_HEADER_COLOUR = '5A6473'
RESPONDENT_HEADER_FONT_COLOUR = 'FFFFFF'
RESPONDENT_TYPE_COLOUR = 'F3F2F1'
RESPONDENT_TYPE_FONT_COLOUR = '605E5C'
RESPONDENT_BANDS = ('F3F2F1', 'E9E7E5')
RESPONDENT_FONT_COLOUR = '898785'

# Fill/font per component type, matching the dashboard's question type pills.
QUESTION_TYPE_COLOURS = {
    FormIoComponentType.RADIO.value: ('EAF3DE', '27500A'),  # green
    FormIoComponentType.SURVEY.value: ('FEF1D8', '7A4F00'),  # yellow
    FormIoComponentType.RANKING.value: ('F3ECF8', '5C2D91'),  # purple
    FormIoComponentType.CHECKBOX.value: ('E6F1FB', '0C447C'),  # blue
    FormIoComponentType.SELECTLIST.value: ('FBE9F0', '7A0C3A'),  # red
    FormIoComponentType.TEXTAREA.value: ('E8F4F8', '006064'),  # teal - free text
    FormIoComponentType.TEXTFIELD.value: ('E8F4F8', '006064'),  # teal - free text
}

# Fallback for an unrecognised component type.
DEFAULT_QUESTION_TYPE_COLOUR = ('F0F0F0', '474543')

# Type label shown in the type header row.
QUESTION_TYPE_LABELS = {
    FormIoComponentType.RADIO.value: 'RADIO',
    FormIoComponentType.SURVEY.value: 'LIKERT MATRIX',
    FormIoComponentType.RANKING.value: 'RANK ORDER',
    FormIoComponentType.CHECKBOX.value: 'CHECKBOX',
    FormIoComponentType.SELECTLIST.value: 'DROPDOWN',
    FormIoComponentType.TEXTAREA.value: 'FREE TEXT',
    FormIoComponentType.TEXTFIELD.value: 'FREE TEXT',
}

BODY_FONT_COLOUR = '2D2D2D'
CELL_BORDER_COLOUR = 'E0DEDC'

NUMERIC_FONT_COLOUR = '013366'  # Likert scale and rank order positions
CHECKBOX_SELECTED_FONT_COLOUR = '1C7A5E'  # a ticked checkbox
MUTED_FONT_COLOUR = 'C8C3BE'  # an unticked checkbox, and any unanswered question

# Aggregated sheet headers, grouped by which question types the columns apply to.
AGGREGATE_HEADER_DESCRIBE_COLOUR = '5A6473'  # type, question, option
AGGREGATE_HEADER_TALLY_COLOUR = '1E5189'  # count and percentage
AGGREGATE_HEADER_LIKERT_COLOUR = '9A5C00'  # Likert matrix only
AGGREGATE_HEADER_RANK_COLOUR = '4A1A8C'  # rank order only

# Neutral, so it divides the page rather than competing with the page banner.
QUESTION_BANNER_COLOUR = 'E7E6E6'

# Neutral an unanswered cell's band is blended toward, and how far.
MUTED_FILL_NEUTRAL = 'E8E6E4'
MUTED_FILL_STRENGTH = 0.5


def get_page_colours(page_index: int) -> PageColours:
    """Get the colour set for a survey page, cycling the palette for long surveys."""
    return PAGE_COLOURS[page_index % len(PAGE_COLOURS)]


def mute_colour(hex_colour: str) -> str:
    """Drain a fill toward neutral grey, for a cell holding no answer.

    An empty cell has no text to grey, so the greying happens in the fill. Blending rather
    than replacing keeps the page's colour coding readable.
    """
    channels = ((hex_colour[i:i + 2], MUTED_FILL_NEUTRAL[i:i + 2]) for i in (0, 2, 4))
    blended = (
        round(int(source, 16) + (int(target, 16) - int(source, 16)) * MUTED_FILL_STRENGTH)
        for source, target in channels
    )
    return ''.join(f'{value:02X}' for value in blended)


def get_zebra_colour(page_index: int, row_index: int) -> str:
    """Get the zebra stripe fill for a data row within a page's columns."""
    colours = get_page_colours(page_index)
    return colours.band_light if row_index % 2 == 0 else colours.band_dark


def get_respondent_zebra_colour(row_index: int) -> str:
    """Get the zebra stripe fill for a data row in the respondent id column."""
    return RESPONDENT_BANDS[row_index % len(RESPONDENT_BANDS)]


def get_question_type_colours(component_type: str) -> tuple:
    """Get the (fill, font) colours for the type label of the given component type."""
    return QUESTION_TYPE_COLOURS.get(component_type, DEFAULT_QUESTION_TYPE_COLOUR)


def get_question_type_label(component_type: str) -> str:
    """Get the display label shown in the type header row for a component type."""
    return QUESTION_TYPE_LABELS.get(component_type, '')

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
"""Colour palette and cell styling helpers for the dashboard spreadsheet export.

The dashboard export colour-codes rows two ways at once:

* by survey page - every data row belonging to a page is zebra striped in two tints of
  that page's colour, so the page a row came from is readable at a glance and matches the
  page header;
* by question type - the question header row for each question is filled with that
  component type's colour (radio green, Likert yellow, ranking purple, checkbox blue,
  drop-down red), matching the type pills shown on the dashboard itself.

Colours are kept here rather than in the service so every sheet builder styles rows the
same way.
"""
from met_api.constants.report_setting_type import FormIoComponentType


# Base colour per survey page, cycled by page index. Page 1 is blue to match the
# dashboard's own page header treatment.
PAGE_BASE_COLOURS = (
    '1B5E8C',  # blue
    '00696E',  # teal
    '5C2D91',  # purple
    'A5541F',  # orange
    '2E6B3E',  # green
    '8A2F5E',  # magenta
    '3B4A8C',  # indigo
    '7A4F00',  # brown
)

# Fraction of white blended into a page's base colour for each zebra band. Both bands stay
# light enough to keep black body text readable.
ZEBRA_BAND_TINTS = (0.88, 0.97)

# Fill/font pairs per FormIO component type, matching the dashboard's question type pills.
QUESTION_TYPE_COLOURS = {
    FormIoComponentType.RADIO.value: ('EAF3DE', '27500A'),  # green
    FormIoComponentType.SURVEY.value: ('FEF1D8', '7A4F00'),  # yellow
    FormIoComponentType.RANKING.value: ('F3ECF8', '5C2D91'),  # purple
    FormIoComponentType.CHECKBOX.value: ('E6F1FB', '0C447C'),  # blue
    FormIoComponentType.SELECTLIST.value: ('FBE9F0', '7A0C3A'),  # red
    FormIoComponentType.TEXTAREA.value: ('F0F0F0', '474543'),  # grey - free text
    FormIoComponentType.TEXTFIELD.value: ('F0F0F0', '474543'),  # grey - free text
}

# Used for a question whose component type has no colour assigned above.
DEFAULT_QUESTION_TYPE_COLOUR = ('F0F0F0', '474543')

# Sheet title banner (row 1 of every sheet) and the column header row beneath it.
SHEET_TITLE_COLOUR = '013366'
SHEET_TITLE_FONT_COLOUR = 'FFFFFF'
COLUMN_HEADER_COLOUR = 'F0EFEE'
COLUMN_HEADER_FONT_COLOUR = '2D2D2D'


def blend_with_white(hex_colour: str, white_fraction: float) -> str:
    """Lighten a hex colour by blending the given fraction of white into it.

    `white_fraction` of 0 returns the colour unchanged, 1 returns pure white.
    """
    white_fraction = min(max(white_fraction, 0.0), 1.0)
    channels = (hex_colour[0:2], hex_colour[2:4], hex_colour[4:6])
    blended = (
        round(int(channel, 16) + (255 - int(channel, 16)) * white_fraction)
        for channel in channels
    )
    return ''.join(f'{value:02X}' for value in blended)


def get_page_colour(page_index: int) -> str:
    """Get the base colour for a survey page, cycling the palette for long surveys."""
    return PAGE_BASE_COLOURS[page_index % len(PAGE_BASE_COLOURS)]


def get_page_band_colours(page_index: int) -> tuple:
    """Get the two zebra stripe colours for a survey page, as tints of its base colour."""
    base = get_page_colour(page_index)
    return tuple(blend_with_white(base, tint) for tint in ZEBRA_BAND_TINTS)


def get_zebra_colour(page_index: int, row_index: int) -> str:
    """Get the zebra stripe colour for a data row, given its page and position in that page."""
    bands = get_page_band_colours(page_index)
    return bands[row_index % len(bands)]


def get_question_type_colours(component_type: str) -> tuple:
    """Get the (fill, font) colours for a question header row of the given component type."""
    return QUESTION_TYPE_COLOURS.get(component_type, DEFAULT_QUESTION_TYPE_COLOUR)

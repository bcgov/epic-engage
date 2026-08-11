# Copyright © 2019 Province of British Columbia
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
"""Walk the components of a form.io form_json.

A question is not always a direct child of the form or of a wizard page: the builder nests
components inside layout containers (panels, fieldsets, well, columns), so anything that reads
questions out of a form has to descend rather than take one level. Missing a nested question is
silent and shows up far downstream - a survey answer never becomes a comment, or a question is
absent from the report settings that the dashboard resolves its label through.
"""


def walk_components(component, found: list):
    """Depth-first collect every keyed component nested under `component`, `component` included."""
    if not isinstance(component, dict):
        return
    if component.get('key'):
        found.append(component)
    for child in component.get('components', []) or []:
        walk_components(child, found)
    for column in component.get('columns', []) or []:
        walk_components(column, found)


def flatten_components(form_json: dict) -> list:
    """Flatten every keyed component in a form_json, regardless of wizard/panel/column nesting."""
    components = []
    for top in (form_json or {}).get('components', []) or []:
        walk_components(top, components)
    return components


def iter_pages(form_json: dict) -> list:
    """Yield the form's pages as (page, components) pairs, in form order.

    A wizard's pages are its top-level components; any other display is treated as a single
    untitled page so callers have one shape to work with either way.
    """
    form_json = form_json or {}
    top_level = form_json.get('components', []) or []
    is_wizard = form_json.get('display') == 'wizard' and bool(top_level)
    pages = top_level if is_wizard else [{'components': top_level, 'title': ''}]

    result = []
    for page in pages:
        components = []
        walk_components(page, components)
        result.append((page, components))
    return result

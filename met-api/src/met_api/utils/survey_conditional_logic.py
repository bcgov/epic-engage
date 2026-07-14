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
"""Extract conditional-visibility links between survey questions from form_json.

A follow-up free-text question (simpletextarea/simpletextfield) is often only shown to a
respondent when they picked a specific answer on an earlier question - either a specific row of
a Likert (simplesurvey) or Ranking (simpleranking) matrix, or a specific option of a plain
Radio (simpleradios) / Dropdown (simpleselect) question. That relationship is never persisted
on its own - it only exists inside the follow-up component's form.io "conditional" config - so
it has to be recovered by parsing each component's conditional settings.

Checkbox (simplecheckboxes) triggers are deliberately not handled here: unlike radio/select,
a checkbox's submitted value is an object of booleans keyed by option (`{optionKey: bool}`), a
different shape from the string-equality pattern this module parses.

Form.io resolves a component's visibility from whichever of these is populated, in this
precedence order: the Advanced JavaScript conditional (``customConditional``) or the Advanced
Conditional / JSON Logic builder (``conditional.json``) - whichever has content wins over the
simple conditional (``conditional.when``/``conditional.eq``). In practice only one of
customConditional/conditional.json is ever populated for a given component, but both still take
priority over the simple conditional when present, so this module never reads
``conditional.when``/``eq`` for a component that has either advanced field set.
"""
import re


MATRIX_TYPES = {'simplesurvey', 'simpleranking'}
SIMPLE_TRIGGER_TYPES = {'simpleradios', 'simpleselect'}
TRIGGER_TYPES = MATRIX_TYPES | SIMPLE_TRIGGER_TYPES
FOLLOW_UP_TYPES = {'simpletextarea', 'simpletextfield'}

# Matches `data.<key>.<rowKey> === '<value>'` (matrix row) or the flatter `data.<key> === '<value>'`
# (plain radio/select) inside a customConditional JS expression, `!==` included so it can be
# recognized and dropped. Only this common "ORed equality checks" pattern is supported -
# arbitrary JS is not evaluated.
_JS_COMPARISON_RE = re.compile(
    r"data\.(?P<key>\w+)(?:\.(?P<row_key>\w+))?\s*(?P<op>===|!==)\s*['\"](?P<value>[^'\"]*)['\"]"
)


def _walk_components(component, out):
    """Depth-first collect every keyed component nested under `component`, `component` included."""
    if not isinstance(component, dict):
        return
    if component.get('key'):
        out.append(component)
    for child in component.get('components', []) or []:
        _walk_components(child, out)
    for column in component.get('columns', []) or []:
        _walk_components(column, out)


def _flatten_components(form_json: dict) -> list:
    """Flatten every keyed component in a form_json, regardless of wizard/panel/column nesting."""
    components = []
    for top in form_json.get('components', []) or []:
        _walk_components(top, components)
    return components


def _matrix_row_labels(matrix_component: dict) -> dict:
    """Map a Likert/Ranking matrix's row/statement key to its display label."""
    if matrix_component.get('type') == 'simplesurvey':
        return {q.get('value'): q.get('label') for q in matrix_component.get('questions', []) or []}
    if matrix_component.get('type') == 'simpleranking':
        return {s.get('id'): s.get('label') for s in matrix_component.get('statements', []) or []}
    return {}


def _value_labels(component: dict) -> dict:
    """Map a component's option/scale value codes to their display labels, e.g. 'other' -> 'Other'.

    Populated from `values[]` (present on simpleradios/simpleselect, and on simplesurvey as its
    shared Likert scale). Ranking has no such list - rank position ('1', '2', ...) is already
    human-meaningful as an ordinal, so callers are expected to format it themselves.
    """
    return {v.get('value'): v.get('label') for v in component.get('values', []) or []}


def _triggers_from_custom_conditional(js_expression: str) -> list:
    """Extract (trigger_key, row_key, value) equality triggers from a raw customConditional JS string.

    `row_key` is ``None`` for a plain radio/select trigger (`data.key === 'value'`) and the
    matrix sub-field for a Likert/Ranking trigger (`data.matrixKey.rowKey === 'value'`).
    Comparisons using `!==` are dropped - a not-equal check can't be resolved to a specific,
    enumerable set of trigger values the way an OR'd chain of `===` checks can.
    """
    triggers = []
    for match in _JS_COMPARISON_RE.finditer(js_expression or ''):
        if match.group('op') != '===':
            continue
        triggers.append((match.group('key'), match.group('row_key'), match.group('value')))
    return triggers


def _triggers_from_json_logic(node, trigger_key=None, row_key=None, out=None) -> list:
    """Recursively walk a conditional.json jsonLogic tree, collecting (trigger_key, row_key, value) triggers.

    Handles the shapes produced by the visual condition builder:
      Radio/select: {"in": [{"var": "<key>"}, [...values]]}
      Likert:       {"in": [{"var": "<matrix>.<row>"}, [...values]]}
      Ranking:      {"some": [{"var": "<matrix>"}, {"and": [
                        {"===": [{"var": "statementId"}, "<row>"]},
                        {"in": [{"var": "rank"}, [...values]]}]}]}
    """
    if out is None:
        out = []
    if not isinstance(node, dict):
        return out

    _collect_in_triggers(node.get('in'), trigger_key, row_key, out)
    _walk_some(node.get('some'), row_key, out)
    _walk_and(node.get('and'), trigger_key, row_key, out)
    _walk_or(node.get('or'), trigger_key, row_key, out)

    return out


def _collect_in_triggers(in_args, trigger_key, row_key, out):
    """Handle a jsonLogic `{"in": [<var>, [...values]]}` node, appending any resolved triggers."""
    if not (isinstance(in_args, list) and len(in_args) == 2):
        return
    var_node, values_node = in_args
    values = values_node if isinstance(values_node, list) else []
    var_path = var_node.get('var') if isinstance(var_node, dict) else None
    if not isinstance(var_path, str) or not var_path:
        return

    if '.' in var_path:
        # Likert: the var already carries "<matrix>.<row>".
        matrix, row = var_path.split('.', 1)
        out.extend((matrix, row, value) for value in values)
    elif var_path == 'rank' and trigger_key and row_key:
        # Ranking: matrix/row are resolved from the enclosing `some`/`and` scope.
        out.extend((trigger_key, row_key, value) for value in values)
    elif var_path != 'rank':
        # A bare component key: a plain radio/select trigger.
        out.extend((var_path, None, value) for value in values)


def _walk_some(some_args, row_key, out):
    """Handle a jsonLogic `{"some": [{"var": "<matrix>"}, <predicate>]}` node."""
    if not (isinstance(some_args, list) and len(some_args) == 2):
        return
    scope_node, predicate_node = some_args
    scope_key = scope_node.get('var') if isinstance(scope_node, dict) else None
    _triggers_from_json_logic(predicate_node, trigger_key=scope_key, row_key=row_key, out=out)


def _resolve_and_row_key(and_args, row_key):
    """Find a `{"===": [{"var": "statementId"}, "<row>"]}` branch, if any, within an `and` group."""
    for branch in and_args:
        eq_args = branch.get('===') if isinstance(branch, dict) else None
        if isinstance(eq_args, list) and len(eq_args) == 2:
            left, right = eq_args
            if isinstance(left, dict) and left.get('var') == 'statementId' and isinstance(right, str):
                return right
    return row_key


def _walk_and(and_args, trigger_key, row_key, out):
    """Handle a jsonLogic `{"and": [...]}` node, resolving a ranking row key first if present."""
    if not isinstance(and_args, list):
        return
    resolved_row_key = _resolve_and_row_key(and_args, row_key)
    for branch in and_args:
        _triggers_from_json_logic(branch, trigger_key=trigger_key, row_key=resolved_row_key, out=out)


def _walk_or(or_args, trigger_key, row_key, out):
    """Handle a jsonLogic `{"or": [...]}` node."""
    if not isinstance(or_args, list):
        return
    for branch in or_args:
        _triggers_from_json_logic(branch, trigger_key=trigger_key, row_key=row_key, out=out)


def _triggers_for_component(component: dict) -> list:
    """Get the raw (trigger_key, row_key, value) triggers for a follow-up component's conditional."""
    json_logic = (component.get('conditional') or {}).get('json')
    if json_logic:
        return _triggers_from_json_logic(json_logic)
    custom_conditional = component.get('customConditional')
    if custom_conditional:
        return _triggers_from_custom_conditional(custom_conditional)
    return []


def _resolve_link(triggers: list, matrix_row_labels: dict, simple_trigger_keys: set, components_by_key: dict):
    """Group parsed triggers into a single resolved link, or None if none are resolvable.

    A follow-up conditional on more than one distinct trigger/row isn't representable as a
    single "grouped under this" link, so only the first one found is kept.
    """
    by_trigger = {}
    for trigger_key, row_key, value in triggers:
        if row_key is not None:
            if trigger_key not in matrix_row_labels or row_key not in matrix_row_labels[trigger_key]:
                continue
        elif trigger_key not in simple_trigger_keys:
            continue
        by_trigger.setdefault((trigger_key, row_key), []).append(value)

    if not by_trigger:
        return None

    (trigger_key, row_key), trigger_values = next(iter(by_trigger.items()))
    value_labels = _value_labels(components_by_key[trigger_key])
    return {
        'trigger_key': trigger_key,
        'row_key': row_key,
        'row_label': matrix_row_labels[trigger_key][row_key] if row_key is not None else None,
        'trigger_values': trigger_values,
        'trigger_value_labels': [value_labels.get(value, value) for value in trigger_values],
    }


def extract_conditional_links(form_json: dict) -> dict:
    """Map each conditionally-shown free-text component to the question/row that triggers it.

    Returns ``{follow_up_key: {'trigger_key': ..., 'row_key': ..., 'row_label': ...,
    'trigger_values': [...], 'trigger_value_labels': [...]}}``. `row_key`/`row_label` are
    ``None`` when the trigger is a plain radio/select question rather than a specific Likert row
    or Ranking statement. `trigger_value_labels` mirrors `trigger_values` with each code resolved
    to its display label (e.g. 'other' -> 'Other', 'disagree' -> 'Disagree') where a label list is
    available - falling back to the raw code otherwise (always true for Ranking's rank numbers,
    which have no label list to resolve against).

    A follow-up whose conditional can't be parsed (unsupported JS pattern, unknown/unresolved
    trigger component, no advanced conditional at all) is silently omitted rather than raising,
    since this is meant to opportunistically group what it can.

    A follow-up conditional on more than one distinct trigger/row isn't representable as a
    single "grouped under this" link, so only the first one found is kept.
    """
    form_json = form_json or {}
    components = _flatten_components(form_json)
    components_by_key = {component['key']: component for component in components}
    matrix_row_labels = {
        component['key']: _matrix_row_labels(component)
        for component in components
        if component.get('type') in MATRIX_TYPES
    }
    simple_trigger_keys = {
        component['key'] for component in components if component.get('type') in SIMPLE_TRIGGER_TYPES
    }

    links = {}
    for component in components:
        if component.get('type') not in FOLLOW_UP_TYPES:
            continue
        triggers = _triggers_for_component(component)
        link = _resolve_link(triggers, matrix_row_labels, simple_trigger_keys, components_by_key)
        if link:
            links[component['key']] = link

    return links

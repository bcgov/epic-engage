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

Checkbox (simplecheckboxes) triggers work like a matrix rather than like radio/select: the
submitted value is an object of booleans keyed by option (`{optionKey: bool}`), so a follow-up
hangs off one *option* of the checkbox the way another hangs off one row of a Likert. The option
is therefore recorded as the link's row, and the value only ever says the box was ticked.

Form.io resolves a component's visibility from whichever of these is populated, in this
precedence order: the Advanced JavaScript conditional (``customConditional``) or the Advanced
Conditional / JSON Logic builder (``conditional.json``) - whichever has content wins over the
simple conditional (``conditional.show``/``when``/``eq``). In practice only one of
customConditional/conditional.json is ever populated for a given component, but both still take
priority over the simple conditional when present, so this module only reads
``conditional.when``/``eq`` for a component that has neither advanced field set.
"""
import re

from met_api.utils.form_components import flatten_components


MATRIX_TYPES = {'simplesurvey', 'simpleranking'}
# Types whose answer is a collection of independently-picked options rather than one value: a
# checkbox submits `{optionKey: bool}` and a multi-select dropdown an array of option keys. Either
# way a follow-up hangs off one *option*, so a dropdown can act as both kinds of trigger.
MEMBERSHIP_TYPES = {'simplecheckboxes', 'simpleselect'}
SIMPLE_TRIGGER_TYPES = {'simpleradios', 'simpleselect'}
# Triggers a follow-up can hang off one sub-field of, rather than off the answer as a whole.
ROW_TRIGGER_TYPES = MATRIX_TYPES | MEMBERSHIP_TYPES
TRIGGER_TYPES = ROW_TRIGGER_TYPES | SIMPLE_TRIGGER_TYPES
FOLLOW_UP_TYPES = {'simpletextarea', 'simpletextfield'}

# Picking an option out of a collection says only that it was picked, so this is the only value a
# membership-triggered link can carry - the option itself is named by the row label.
CHECKED_VALUE = 'true'
CHECKED_LABEL = 'Selected'

# Matches `data.<key>.<rowKey> === '<value>'` (matrix row) or the flatter `data.<key> === '<value>'`
# (plain radio/select) inside a customConditional JS expression, `!==` included so it can be
# recognized and dropped. Only this common "ORed equality checks" pattern is supported -
# arbitrary JS is not evaluated.
_JS_COMPARISON_RE = re.compile(
    r"data\.(?P<key>\w+)(?:\.(?P<row_key>\w+))?\s*(?P<op>===|!==)\s*['\"](?P<value>[^'\"]*)['\"]"
)

# Matches the array-membership form the same field takes when a condition covers several answers
# at once, e.g. `['important', 'mostImportant'].includes(data.valuedComponents.airQuality)`. A
# negated check is captured only so it can be dropped, like `!==` above.
_JS_INCLUDES_RE = re.compile(
    r'(?P<negated>!\s*)?\[(?P<values>[^\]]*)\]\s*\.includes\(\s*data\.(?P<key>\w+)(?:\.(?P<row_key>\w+))?\s*\)'
)

# Matches the mirror-image membership check a multi-select dropdown needs - `data.<key>.includes(
# '<option>')` - where the submitted answer is the array being searched rather than the needle.
_JS_DATA_INCLUDES_RE = re.compile(
    r"(?P<negated>!\s*)?data\.(?P<key>\w+)\s*\.includes\(\s*['\"](?P<value>[^'\"]*)['\"]\s*\)"
)

_JS_STRING_RE = re.compile(r"['\"]([^'\"]*)['\"]")

# Matches a bare `data.<key>.<optionKey>` read with no comparison against it - `show =
# data.simplecheckboxes1.airQuality`, which is how a checkbox option's "is this ticked" test is
# written. Only applied to what is left after the comparison and membership patterns above have
# been blanked out, so it cannot re-match one of their operands. The lookahead keeps it off an
# unsupported comparison (`==`, `<`) whose right-hand side would decide the answer, and a negated
# read is captured only so it can be dropped.
_JS_TRUTHY_RE = re.compile(r'(?P<negated>!\s*)?data\.(?P<key>\w+)\.(?P<row_key>\w+)(?!\s*[=!<>])')


def _row_labels(component: dict) -> dict:
    """Map a trigger's sub-field key to its display label.

    A follow-up can hang off one Likert question, one Ranking statement, or one Checkbox option -
    each is addressed as `data.<key>.<row_key>` in a conditional and named by its own label.
    """
    if component.get('type') == 'simplesurvey':
        return {q.get('value'): q.get('label') for q in component.get('questions', []) or []}
    if component.get('type') == 'simpleranking':
        return {s.get('id'): s.get('label') for s in component.get('statements', []) or []}
    if component.get('type') in MEMBERSHIP_TYPES:
        return {v.get('value'): v.get('label') for v in component.get('values', []) or []}
    return {}


def _value_labels(component: dict) -> dict:
    """Map a component's option/scale value codes to their display labels, e.g. 'other' -> 'Other'.

    Populated from `values[]` (present on simpleradios/simpleselect, and on simplesurvey as its
    shared Likert scale). Ranking has no such list - rank position ('1', '2', ...) is already
    human-meaningful as an ordinal, so callers are expected to format it themselves.
    """
    return {v.get('value'): v.get('label') for v in component.get('values', []) or []}


def _triggers_from_custom_conditional(js_expression: str) -> list:
    """Extract (trigger_key, row_key, value) triggers from a raw customConditional JS string.

    Both hand-written shapes are read: an OR'd chain of `===` comparisons, and the
    `['a', 'b'].includes(data.key)` membership check authors reach for when a condition covers
    several answers. `row_key` is ``None`` for a plain radio/select trigger and the matrix
    sub-field for a Likert/Ranking one. Negated checks are dropped - a not-equal check can't be
    resolved to a specific, enumerable set of trigger values.
    """
    expression = js_expression or ''
    triggers = []
    for match in _JS_COMPARISON_RE.finditer(expression):
        if match.group('op') != '===':
            continue
        triggers.append((match.group('key'), match.group('row_key'), match.group('value')))
    for match in _JS_INCLUDES_RE.finditer(expression):
        if match.group('negated'):
            continue
        triggers.extend(
            (match.group('key'), match.group('row_key'), value)
            for value in _JS_STRING_RE.findall(match.group('values'))
        )

    # A multi-select's answer is the array being searched, so the option is the argument. Like a
    # ticked checkbox, being in the array is the whole condition.
    for match in _JS_DATA_INCLUDES_RE.finditer(expression):
        if match.group('negated'):
            continue
        triggers.append((match.group('key'), match.group('value'), CHECKED_VALUE))

    # Whatever `data.<key>.<row>` reads survive every pattern above being blanked out are bare
    # truthiness tests - a ticked checkbox option, which carries no value to compare against.
    remainder = _JS_DATA_INCLUDES_RE.sub(' ', _JS_INCLUDES_RE.sub(' ', _JS_COMPARISON_RE.sub(' ', expression)))
    for match in _JS_TRUTHY_RE.finditer(remainder):
        if match.group('negated'):
            continue
        triggers.append((match.group('key'), match.group('row_key'), CHECKED_VALUE))
    return triggers


def _triggers_from_simple_conditional(conditional: dict) -> list:
    """Extract the single trigger encoded by form.io's simple conditional (`show`/`when`/`eq`).

    This is the "Conditional" tab in the builder - "Show this component when `when` is `eq`" -
    and is how most single-answer follow-ups ("Other, please specify") are actually authored.
    Only a show-when on a non-empty value is usable: a hide-when (`show: false`) names the
    answers the follow-up is *not* shown for, and an empty `eq` names no answer at all.
    """
    when = conditional.get('when')
    eq = conditional.get('eq')
    if not when or eq in (None, '') or str(conditional.get('show')).lower() != 'true':
        return []
    # A sub-field is addressed as "<key>.<row>" here just as it is in JS, e.g. a checkbox option
    # ("simplecheckboxes1.airQuality", eq true) or a single Likert row.
    trigger_key, _, row_key = when.partition('.')
    return [(trigger_key, row_key or None, str(eq).lower() if isinstance(eq, bool) else str(eq))]


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

    # `{"in": ["<option>", {"var": "<key>"}]}` - operands swap round when the answer itself is the
    # collection being searched (a multi-select dropdown), so the option is the needle.
    if isinstance(var_node, str) and isinstance(values_node, dict):
        haystack = values_node.get('var')
        if isinstance(haystack, str) and haystack:
            out.append((haystack, var_node, CHECKED_VALUE))
        return

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
    """Get the raw (trigger_key, row_key, value) triggers for a follow-up component's conditional.

    Read in form.io's own resolution order, so the link describes the condition that actually
    gates the question rather than a stale one left behind in another field.
    """
    conditional = component.get('conditional') or {}
    json_logic = conditional.get('json')
    if json_logic:
        return _triggers_from_json_logic(json_logic)
    custom_conditional = component.get('customConditional')
    if custom_conditional:
        return _triggers_from_custom_conditional(custom_conditional)
    return _triggers_from_simple_conditional(conditional)


def _trigger_value_labels(trigger_component: dict, trigger_values: list) -> list:
    """Resolve raw trigger value codes to their display labels.

    'true' is not a code any option list can resolve - it is a ticked checkbox reporting its own
    boolean, and the option it belongs to is already named by the link's row label.
    """
    value_labels = _value_labels(trigger_component)
    return [
        value_labels.get(value) or (CHECKED_LABEL if value == CHECKED_VALUE else value) for value in trigger_values
    ]


def _resolve_link(triggers: list, row_labels: dict, simple_trigger_keys: set, components_by_key: dict):
    """Group parsed triggers into a single resolved link, or None if none are resolvable.

    A follow-up conditional on more than one distinct trigger/row isn't representable as a
    single "grouped under this" link, so only the first one found is kept.
    """
    by_trigger = {}
    for trigger_key, row_key, value in triggers:
        if row_key is not None:
            if trigger_key not in row_labels or row_key not in row_labels[trigger_key]:
                continue
        elif trigger_key not in simple_trigger_keys:
            continue
        by_trigger.setdefault((trigger_key, row_key), []).append(value)

    if not by_trigger:
        return None

    (trigger_key, row_key), trigger_values = next(iter(by_trigger.items()))
    trigger_component = components_by_key[trigger_key]
    return {
        'trigger_key': trigger_key,
        # The question the follow-ups hang off. Consumers that group several follow-ups into one
        # block need something to title it with, and the follow-ups' own labels vary.
        'trigger_label': trigger_component.get('label'),
        'row_key': row_key,
        'row_label': row_labels[trigger_key][row_key] if row_key is not None else None,
        'trigger_values': trigger_values,
        'trigger_value_labels': _trigger_value_labels(trigger_component, trigger_values),
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
    components = flatten_components(form_json)
    components_by_key = {component['key']: component for component in components}
    row_labels = {
        component['key']: _row_labels(component)
        for component in components
        if component.get('type') in ROW_TRIGGER_TYPES
    }
    simple_trigger_keys = {
        component['key'] for component in components if component.get('type') in SIMPLE_TRIGGER_TYPES
    }

    links = {}
    for component in components:
        if component.get('type') not in FOLLOW_UP_TYPES:
            continue
        triggers = _triggers_for_component(component)
        link = _resolve_link(triggers, row_labels, simple_trigger_keys, components_by_key)
        if link:
            # The follow-up's own label, so a consumer can name it from the form even when the
            # question is absent from the report settings or has drawn no comments yet.
            link['follow_up_label'] = component.get('label')
            links[component['key']] = link

    return links

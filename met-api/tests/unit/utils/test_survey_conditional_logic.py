"""Tests for the survey conditional-logic extraction utility."""
from met_api.utils.survey_conditional_logic import extract_conditional_links


def _likert_component(key='simplesurvey1'):
    return {
        'key': key,
        'type': 'simplesurvey',
        'questions': [
            {'value': 'rowA', 'label': 'Row A label'},
            {'value': 'rowB', 'label': 'Row B label'},
        ],
        'values': [
            {'value': 'stronglyDisagree', 'label': 'Strongly Disagree'},
            {'value': 'disagree', 'label': 'Disagree'},
            {'value': 'agree', 'label': 'Agree'},
        ],
    }


def _ranking_component(key='simpleranking1'):
    return {
        'key': key,
        'type': 'simpleranking',
        'statements': [
            {'id': 'stmt1', 'label': 'Statement one'},
            {'id': 'stmt2', 'label': 'Statement two'},
        ],
    }


def _followup_component(key, conditional=None, custom_conditional=None):
    component = {'key': key, 'type': 'simpletextarea'}
    if conditional is not None:
        component['conditional'] = conditional
    if custom_conditional is not None:
        component['customConditional'] = custom_conditional
    return component


def _wizard_form(*components):
    return {'display': 'wizard', 'components': [{'key': 'page1', 'components': list(components)}]}


def test_real_tofino_custom_conditional_example():
    """The exact customConditional pattern captured from a real Tofino Tour survey."""
    custom_conditional = (
        'show = data.simplesurvey1 && (\n'
        "    data.simplesurvey1.iWouldConsiderVisitingTofinoWithinTheNextFewYears === 'disagree' ||\n"
        "    data.simplesurvey1.iWouldConsiderVisitingTofinoWithinTheNextFewYears === 'stronglyDisagree'\n"
        '  );'
    )
    likert = {
        'key': 'simplesurvey1',
        'type': 'simplesurvey',
        'questions': [
            {
                'value': 'iWouldConsiderVisitingTofinoWithinTheNextFewYears',
                'label': 'I would consider visiting Tofino within the next few years.',
            },
        ],
        'values': [
            {'value': 'stronglyDisagree', 'label': 'Strongly Disagree'},
            {'value': 'disagree', 'label': 'Disagree'},
            {'value': 'neutral', 'label': 'Neutral'},
            {'value': 'agree', 'label': 'Agree'},
            {'value': 'stronglyAgree', 'label': 'Strongly Agree'},
        ],
    }
    followup = _followup_component('simpletextarea1', custom_conditional=custom_conditional)
    form_json = _wizard_form(likert, followup)

    links = extract_conditional_links(form_json)

    assert links == {
        'simpletextarea1': {
            'trigger_key': 'simplesurvey1',
            'row_key': 'iWouldConsiderVisitingTofinoWithinTheNextFewYears',
            'row_label': 'I would consider visiting Tofino within the next few years.',
            'trigger_values': ['disagree', 'stronglyDisagree'],
            'trigger_value_labels': ['Disagree', 'Strongly Disagree'],
        },
    }


def test_json_logic_likert_in_shape():
    """A Likert row conditional built with the visual condition builder (conditional.json)."""
    likert = _likert_component()
    followup = _followup_component(
        'followup1',
        conditional={'json': {'in': [{'var': 'simplesurvey1.rowA'}, ['disagree', 'stronglyDisagree']]}},
    )
    form_json = _wizard_form(likert, followup)

    links = extract_conditional_links(form_json)

    assert links == {
        'followup1': {
            'trigger_key': 'simplesurvey1',
            'row_key': 'rowA',
            'row_label': 'Row A label',
            'trigger_values': ['disagree', 'stronglyDisagree'],
            'trigger_value_labels': ['Disagree', 'Strongly Disagree'],
        },
    }


def test_json_logic_ranking_some_and_shape():
    """A Ranking statement conditional, whose builder-produced jsonLogic uses some/and/in."""
    ranking = _ranking_component()
    followup = _followup_component(
        'followup1',
        conditional={
            'json': {
                'some': [
                    {'var': 'simpleranking1'},
                    {
                        'and': [
                            {'===': [{'var': 'statementId'}, 'stmt2']},
                            {'in': [{'var': 'rank'}, ['1', '2']]},
                        ],
                    },
                ],
            },
        },
    )
    form_json = _wizard_form(ranking, followup)

    links = extract_conditional_links(form_json)

    assert links == {
        'followup1': {
            'trigger_key': 'simpleranking1',
            'row_key': 'stmt2',
            'row_label': 'Statement two',
            'trigger_values': ['1', '2'],
            # Ranking has no per-value label list - raw rank numbers pass through unresolved.
            'trigger_value_labels': ['1', '2'],
        },
    }


def test_json_logic_takes_precedence_over_custom_conditional():
    """When both advanced fields are populated, conditional.json wins (per form.io precedence)."""
    likert = _likert_component()
    followup = _followup_component(
        'followup1',
        conditional={'json': {'in': [{'var': 'simplesurvey1.rowB'}, ['agree']]}},
        custom_conditional="show = data.simplesurvey1.rowA === 'disagree';",
    )
    form_json = _wizard_form(likert, followup)

    links = extract_conditional_links(form_json)

    assert links['followup1']['row_key'] == 'rowB'


def test_advanced_conditional_takes_precedence_over_simple_when_eq():
    """Simple conditional.when/eq is ignored whenever an advanced conditional is also set."""
    likert = _likert_component()
    followup = _followup_component(
        'followup1',
        conditional={'when': 'simplesurvey1', 'eq': 'ignored-simple-value'},
        custom_conditional="show = data.simplesurvey1.rowA === 'disagree';",
    )
    form_json = _wizard_form(likert, followup)

    links = extract_conditional_links(form_json)

    assert links['followup1']['row_key'] == 'rowA'
    assert links['followup1']['trigger_values'] == ['disagree']


def test_not_equal_comparisons_are_dropped():
    """A `!==` check can't be resolved to an enumerable set of trigger values, so it's skipped."""
    likert = _likert_component()
    followup = _followup_component(
        'followup1',
        custom_conditional="show = data.simplesurvey1.rowA !== 'agree';",
    )
    form_json = _wizard_form(likert, followup)

    assert not extract_conditional_links(form_json)


def test_no_conditional_is_omitted():
    """A follow-up with no conditional at all is not linked to anything."""
    likert = _likert_component()
    followup = _followup_component('followup1')
    form_json = _wizard_form(likert, followup)

    assert not extract_conditional_links(form_json)


def test_unparseable_custom_conditional_is_omitted_not_raised():
    """Arbitrary JS that isn't the supported equality pattern is skipped, not evaluated."""
    likert = _likert_component()
    followup = _followup_component(
        'followup1',
        custom_conditional='show = someHelperFunction(data) && data.other.thing;',
    )
    form_json = _wizard_form(likert, followup)

    assert not extract_conditional_links(form_json)


def test_conditional_on_unknown_matrix_key_is_omitted():
    """A conditional referencing a component key that isn't a matrix on this form is dropped."""
    followup = _followup_component(
        'followup1',
        custom_conditional="show = data.doesNotExist.rowA === 'disagree';",
    )
    form_json = _wizard_form(followup)

    assert not extract_conditional_links(form_json)


def test_plain_radio_trigger_via_custom_conditional():
    """A radio/select trigger has no matrix row - row_key/row_label are None."""
    radio = {
        'key': 'simpleradios1',
        'type': 'simpleradios',
        'values': [{'value': 'yes', 'label': 'Yes'}, {'value': 'other', 'label': 'Other'}],
    }
    followup = _followup_component(
        'followup1',
        custom_conditional="show = data.simpleradios1 === 'other';",
    )
    form_json = _wizard_form(radio, followup)

    assert extract_conditional_links(form_json) == {
        'followup1': {
            'trigger_key': 'simpleradios1',
            'row_key': None,
            'row_label': None,
            'trigger_values': ['other'],
            'trigger_value_labels': ['Other'],
        },
    }


def test_plain_select_trigger_via_json_logic():
    """A dropdown (simpleselect) trigger built with the visual condition builder."""
    select = {
        'key': 'simpleselect1',
        'type': 'simpleselect',
        'values': [{'value': 'yes', 'label': 'Yes'}, {'value': 'other', 'label': 'Other'}],
    }
    followup = _followup_component(
        'followup1',
        conditional={'json': {'in': [{'var': 'simpleselect1'}, ['other']]}},
    )
    form_json = _wizard_form(select, followup)

    assert extract_conditional_links(form_json) == {
        'followup1': {
            'trigger_key': 'simpleselect1',
            'row_key': None,
            'row_label': None,
            'trigger_values': ['other'],
            'trigger_value_labels': ['Other'],
        },
    }


def test_checkbox_trigger_is_not_resolved():
    """Checkbox triggers are out of scope - the submitted value is an object, not a string."""
    checkbox = {'key': 'simplecheckboxes1', 'type': 'simplecheckboxes'}
    followup = _followup_component(
        'followup1',
        custom_conditional="show = data.simplecheckboxes1.other === 'true';",
    )
    form_json = _wizard_form(checkbox, followup)

    assert not extract_conditional_links(form_json)


def test_non_wizard_flat_form_is_supported():
    """A single-page (display: form) survey is walked the same as a wizard's pages."""
    likert = _likert_component()
    followup = _followup_component(
        'followup1',
        custom_conditional="show = data.simplesurvey1.rowA === 'disagree';",
    )
    form_json = {'display': 'form', 'components': [likert, followup]}

    links = extract_conditional_links(form_json)

    assert links['followup1']['trigger_key'] == 'simplesurvey1'

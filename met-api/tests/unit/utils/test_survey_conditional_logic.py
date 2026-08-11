"""Tests for the survey conditional-logic extraction utility."""
from met_api.utils.survey_conditional_logic import extract_conditional_links


def _likert_component(key='simplesurvey1'):
    return {
        'key': key,
        'type': 'simplesurvey',
        'label': 'How much do you agree?',
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
        'label': 'Rank these statements',
        'statements': [
            {'id': 'stmt1', 'label': 'Statement one'},
            {'id': 'stmt2', 'label': 'Statement two'},
        ],
    }


def _checkbox_component(key='simplecheckboxes1'):
    return {
        'key': key,
        'type': 'simplecheckboxes',
        'label': 'Which components matter to you?',
        'values': [
            {'value': 'airQuality', 'label': 'Air quality'},
            {'value': 'waterQuality', 'label': 'Water quality'},
        ],
    }


def _followup_component(key, conditional=None, custom_conditional=None):
    component = {'key': key, 'type': 'simpletextarea', 'label': 'Tell us more'}
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
        'label': 'How much do you agree with the following?',
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
            'trigger_label': 'How much do you agree with the following?',
            'row_key': 'iWouldConsiderVisitingTofinoWithinTheNextFewYears',
            'row_label': 'I would consider visiting Tofino within the next few years.',
            'trigger_values': ['disagree', 'stronglyDisagree'],
            'trigger_value_labels': ['Disagree', 'Strongly Disagree'],
            'follow_up_label': 'Tell us more',
        },
    }


def test_real_valued_components_includes_example():
    """The `[...].includes(data.<matrix>.<row>)` pattern real EAO surveys use for Likert rows."""
    likert = _likert_component()
    followup = _followup_component(
        'simpletextarea1',
        custom_conditional="show = ['agree', 'disagree'].includes(data.simplesurvey1.rowB)",
    )
    form_json = _wizard_form(likert, followup)

    assert extract_conditional_links(form_json) == {
        'simpletextarea1': {
            'trigger_key': 'simplesurvey1',
            'trigger_label': 'How much do you agree?',
            'row_key': 'rowB',
            'row_label': 'Row B label',
            'trigger_values': ['agree', 'disagree'],
            'trigger_value_labels': ['Agree', 'Disagree'],
            'follow_up_label': 'Tell us more',
        },
    }


def test_includes_on_plain_radio_trigger():
    """The same membership pattern against a radio's value directly, so there's no row."""
    radio = {
        'key': 'simpleradios1',
        'type': 'simpleradios',
        'label': 'How did you hear about us?',
        'values': [{'value': 'yes', 'label': 'Yes'}, {'value': 'other', 'label': 'Other'}],
    }
    followup = _followup_component(
        'followup1',
        custom_conditional='show = ["other"].includes(data.simpleradios1);',
    )
    form_json = _wizard_form(radio, followup)

    assert extract_conditional_links(form_json)['followup1']['trigger_values'] == ['other']


def test_negated_includes_is_dropped():
    """A negated includes names the answers a follow-up is hidden for, so it can't be linked."""
    likert = _likert_component()
    followup = _followup_component(
        'followup1',
        custom_conditional="show = !['agree'].includes(data.simplesurvey1.rowA);",
    )
    form_json = _wizard_form(likert, followup)

    assert not extract_conditional_links(form_json)


def test_simple_conditional_show_when_eq():
    """The builder's simple Conditional tab - how most "Other, please specify" follow-ups are set."""
    radio = {
        'key': 'simpleradios1',
        'type': 'simpleradios',
        'label': 'How did you hear about us?',
        'values': [{'value': 'yes', 'label': 'Yes'}, {'value': 'other', 'label': 'Other'}],
    }
    followup = _followup_component(
        'followup1',
        conditional={'show': True, 'when': 'simpleradios1', 'eq': 'other'},
    )
    form_json = _wizard_form(radio, followup)

    assert extract_conditional_links(form_json) == {
        'followup1': {
            'trigger_key': 'simpleradios1',
            'trigger_label': 'How did you hear about us?',
            'row_key': None,
            'row_label': None,
            'trigger_values': ['other'],
            'trigger_value_labels': ['Other'],
            'follow_up_label': 'Tell us more',
        },
    }


def test_simple_conditional_hide_when_is_dropped():
    """A hide-when (`show: false`) names the answers the follow-up is *not* shown for."""
    radio = {
        'key': 'simpleradios1',
        'type': 'simpleradios',
        'label': 'How did you hear about us?',
        'values': [{'value': 'other', 'label': 'Other'}],
    }
    followup = _followup_component(
        'followup1',
        conditional={'show': False, 'when': 'simpleradios1', 'eq': 'other'},
    )
    form_json = _wizard_form(radio, followup)

    assert not extract_conditional_links(form_json)


def test_simple_conditional_without_a_value_is_dropped():
    """A `when` with an empty `eq` - left behind when a condition is rebuilt as an advanced one."""
    radio = {
        'key': 'simpleradios1',
        'type': 'simpleradios',
        'label': 'How did you hear about us?',
        'values': [{'value': 'other', 'label': 'Other'}],
    }
    followup = _followup_component('followup1', conditional={'show': True, 'when': 'simpleradios1', 'eq': ''})
    form_json = _wizard_form(radio, followup)

    assert not extract_conditional_links(form_json)


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
            'trigger_label': 'How much do you agree?',
            'row_key': 'rowA',
            'row_label': 'Row A label',
            'trigger_values': ['disagree', 'stronglyDisagree'],
            'trigger_value_labels': ['Disagree', 'Strongly Disagree'],
            'follow_up_label': 'Tell us more',
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
            'trigger_label': 'Rank these statements',
            'row_key': 'stmt2',
            'row_label': 'Statement two',
            'trigger_values': ['1', '2'],
            # Ranking has no per-value label list - raw rank numbers pass through unresolved.
            'trigger_value_labels': ['1', '2'],
            'follow_up_label': 'Tell us more',
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
        'label': 'How did you hear about us?',
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
            'trigger_label': 'How did you hear about us?',
            'row_key': None,
            'row_label': None,
            'trigger_values': ['other'],
            'trigger_value_labels': ['Other'],
            'follow_up_label': 'Tell us more',
        },
    }


def test_plain_select_trigger_via_json_logic():
    """A dropdown (simpleselect) trigger built with the visual condition builder."""
    select = {
        'key': 'simpleselect1',
        'type': 'simpleselect',
        'label': 'How did you hear about us?',
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
            'trigger_label': 'How did you hear about us?',
            'row_key': None,
            'row_label': None,
            'trigger_values': ['other'],
            'trigger_value_labels': ['Other'],
            'follow_up_label': 'Tell us more',
        },
    }


def test_checkbox_option_trigger_via_bare_truthiness():
    """`show = data.<checkbox>.<option>` - a ticked box has no value to compare against."""
    checkbox = _checkbox_component()
    followup = _followup_component(
        'followup1',
        custom_conditional='show = data.simplecheckboxes1.airQuality',
    )
    form_json = _wizard_form(checkbox, followup)

    assert extract_conditional_links(form_json) == {
        'followup1': {
            'trigger_key': 'simplecheckboxes1',
            'trigger_label': 'Which components matter to you?',
            # The option is the row: it is what distinguishes this follow-up from its siblings.
            'row_key': 'airQuality',
            'row_label': 'Air quality',
            'trigger_values': ['true'],
            'trigger_value_labels': ['Selected'],
            'follow_up_label': 'Tell us more',
        },
    }


def test_checkbox_option_trigger_via_equality():
    """The same condition written out as an explicit comparison resolves identically."""
    checkbox = _checkbox_component()
    followup = _followup_component(
        'followup1',
        custom_conditional="show = data.simplecheckboxes1.airQuality === 'true';",
    )
    form_json = _wizard_form(checkbox, followup)

    assert extract_conditional_links(form_json)['followup1'] == {
        'trigger_key': 'simplecheckboxes1',
        'trigger_label': 'Which components matter to you?',
        'row_key': 'airQuality',
        'row_label': 'Air quality',
        'trigger_values': ['true'],
        'trigger_value_labels': ['Selected'],
        'follow_up_label': 'Tell us more',
    }


def test_checkbox_follow_ups_share_one_condition():
    """Every option's follow-up carries the same trigger and value, which is what groups them.

    The dashboard collapses row follow-ups that share a trigger key and trigger values into one
    block; per-option follow-ups only merge because a ticked box always reports 'true'.
    """
    checkbox = _checkbox_component()
    form_json = _wizard_form(
        checkbox,
        _followup_component('air', custom_conditional='show = data.simplecheckboxes1.airQuality'),
        _followup_component('water', custom_conditional='show = data.simplecheckboxes1.waterQuality;'),
    )

    links = extract_conditional_links(form_json)
    assert [(link['trigger_key'], link['trigger_values']) for link in links.values()] == [
        ('simplecheckboxes1', ['true']),
        ('simplecheckboxes1', ['true']),
    ]
    assert [link['row_label'] for link in links.values()] == ['Air quality', 'Water quality']


def test_negated_truthiness_is_dropped():
    """`show = !data.<checkbox>.<option>` names when the follow-up is hidden, not shown."""
    checkbox = _checkbox_component()
    followup = _followup_component(
        'followup1',
        custom_conditional='show = !data.simplecheckboxes1.airQuality',
    )
    form_json = _wizard_form(checkbox, followup)

    assert not extract_conditional_links(form_json)


def test_truthiness_on_an_unsupported_comparison_is_dropped():
    """A comparison this module can't read decides the answer, so the bare read is not trusted."""
    checkbox = _checkbox_component()
    followup = _followup_component(
        'followup1',
        custom_conditional="show = data.simplecheckboxes1.airQuality == 'false'",
    )
    form_json = _wizard_form(checkbox, followup)

    assert not extract_conditional_links(form_json)


def test_checkbox_option_not_on_the_component_is_omitted():
    """An option that no longer exists on the checkbox can't be labelled, so it is dropped."""
    checkbox = _checkbox_component()
    followup = _followup_component(
        'followup1',
        custom_conditional='show = data.simplecheckboxes1.removedOption',
    )
    form_json = _wizard_form(checkbox, followup)

    assert not extract_conditional_links(form_json)


def _multi_select_component(key='simpleselect1'):
    """Build a dropdown with `multiple` set, which submits an array of option keys."""
    return {
        'key': key,
        'type': 'simpleselect',
        'label': 'Which components matter to you?',
        'multiple': True,
        'values': [
            {'value': 'airQuality', 'label': 'Air quality'},
            {'value': 'waterQuality', 'label': 'Water quality'},
        ],
    }


def test_multi_select_option_trigger_via_data_includes():
    """`data.<select>.includes('<option>')` - the answer is the array, so the option is the needle."""
    followup = _followup_component(
        'followup1',
        custom_conditional="show = data.simpleselect1.includes('airQuality');",
    )
    form_json = _wizard_form(_multi_select_component(), followup)

    assert extract_conditional_links(form_json) == {
        'followup1': {
            'trigger_key': 'simpleselect1',
            'trigger_label': 'Which components matter to you?',
            'row_key': 'airQuality',
            'row_label': 'Air quality',
            'trigger_values': ['true'],
            'trigger_value_labels': ['Selected'],
            'follow_up_label': 'Tell us more',
        },
    }


def test_multi_select_option_trigger_via_json_logic():
    """The visual builder swaps the `in` operands round when the answer is the collection."""
    followup = _followup_component(
        'followup1',
        conditional={'json': {'in': ['waterQuality', {'var': 'simpleselect1'}]}},
    )
    form_json = _wizard_form(_multi_select_component(), followup)

    assert extract_conditional_links(form_json)['followup1'] == {
        'trigger_key': 'simpleselect1',
        'trigger_label': 'Which components matter to you?',
        'row_key': 'waterQuality',
        'row_label': 'Water quality',
        'trigger_values': ['true'],
        'trigger_value_labels': ['Selected'],
        'follow_up_label': 'Tell us more',
    }


def test_negated_data_includes_is_dropped():
    """`!data.<select>.includes(...)` names when the follow-up is hidden, not when it shows."""
    followup = _followup_component(
        'followup1',
        custom_conditional="show = !data.simpleselect1.includes('airQuality');",
    )
    form_json = _wizard_form(_multi_select_component(), followup)

    assert not extract_conditional_links(form_json)


def test_data_includes_is_not_read_as_a_truthiness_check():
    """`.includes` must not be mistaken for the option in a bare `data.<key>.<option>` read."""
    followup = _followup_component(
        'followup1',
        custom_conditional="show = data.simpleselect1.includes('airQuality');",
    )
    form_json = _wizard_form(_multi_select_component(), followup)

    assert extract_conditional_links(form_json)['followup1']['row_key'] == 'airQuality'


def test_single_select_trigger_is_unaffected_by_membership_support():
    """A single-value dropdown still resolves to the answer given, with no row."""
    select = {
        'key': 'simpleselect1',
        'type': 'simpleselect',
        'label': 'How did you hear about us?',
        'values': [{'value': 'other', 'label': 'Other'}],
    }
    followup = _followup_component(
        'followup1',
        custom_conditional="show = data.simpleselect1 === 'other';",
    )
    form_json = _wizard_form(select, followup)

    assert extract_conditional_links(form_json)['followup1'] == {
        'trigger_key': 'simpleselect1',
        'trigger_label': 'How did you hear about us?',
        'row_key': None,
        'row_label': None,
        'trigger_values': ['other'],
        'trigger_value_labels': ['Other'],
        'follow_up_label': 'Tell us more',
    }


def test_simple_conditional_on_a_checkbox_option():
    """The builder's simple tab addresses an option as "<key>.<option>", same as the JS does."""
    checkbox = _checkbox_component()
    followup = _followup_component(
        'followup1',
        conditional={'show': True, 'when': 'simplecheckboxes1.waterQuality', 'eq': True},
    )
    form_json = _wizard_form(checkbox, followup)

    assert extract_conditional_links(form_json)['followup1'] == {
        'trigger_key': 'simplecheckboxes1',
        'trigger_label': 'Which components matter to you?',
        'row_key': 'waterQuality',
        'row_label': 'Water quality',
        'trigger_values': ['true'],
        'trigger_value_labels': ['Selected'],
        'follow_up_label': 'Tell us more',
    }


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

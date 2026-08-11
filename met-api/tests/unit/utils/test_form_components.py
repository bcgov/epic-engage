"""Tests for walking the components of a form.io form_json."""
from met_api.services.comment_service import CommentService
from met_api.utils.form_components import flatten_components, iter_pages, walk_components


def _text_field(key, label):
    return {'key': key, 'type': 'simpletextfield', 'label': label, 'inputType': 'text'}


def _nested_wizard():
    """Build a wizard whose follow-up sits inside a panel, as the builder nests layout containers."""
    return {
        'display': 'wizard',
        'components': [
            {
                'key': 'page1',
                'title': 'Page one',
                'components': [
                    {'key': 'simpleradios1', 'type': 'simpleradios', 'label': 'Where do you live?'},
                    {
                        'key': 'panel1',
                        'type': 'panel',
                        'components': [_text_field('simpletextfield1', 'Please specify')],
                    },
                ],
            },
        ],
    }


def test_walk_components_descends_through_panels_and_columns():
    """Layout containers are not questions, but they hold them."""
    found = []
    walk_components(
        {
            'key': 'panel1',
            'components': [
                {'key': 'a'},
                {'key': 'cols', 'columns': [{'key': 'col1', 'components': [{'key': 'b'}]}]},
            ],
        },
        found,
    )

    assert [c['key'] for c in found] == ['panel1', 'a', 'cols', 'col1', 'b']


def test_walk_components_ignores_keyless_and_non_dict_nodes():
    """A layout node without a key is walked through but never collected."""
    found = []
    walk_components({'components': [{'key': 'a'}, None, 'not-a-component']}, found)

    assert [c['key'] for c in found] == ['a']


def test_flatten_components_reaches_a_question_nested_in_a_panel():
    """A panel is not a question, so its contents have to be reached through it."""
    keys = [component['key'] for component in flatten_components(_nested_wizard())]

    assert 'simpletextfield1' in keys


def test_iter_pages_keeps_a_nested_question_on_its_own_page():
    """Nesting must not lose which page a question belongs to."""
    pages = iter_pages(_nested_wizard())

    assert len(pages) == 1
    page, components = pages[0]
    assert page.get('title') == 'Page one'
    assert 'simpletextfield1' in [component['key'] for component in components]


def test_iter_pages_treats_a_non_wizard_form_as_one_untitled_page():
    """Callers get one page shape whether or not the survey is a wizard."""
    form_json = {'display': 'form', 'components': [_text_field('simpletextfield1', 'Please specify')]}

    pages = iter_pages(form_json)

    assert len(pages) == 1
    page, components = pages[0]
    assert page.get('title') == ''
    assert [component['key'] for component in components] == ['simpletextfield1']


def test_comments_are_extracted_from_a_question_nested_in_a_panel():
    """A nested follow-up's answer has to become a comment, or the dashboard reports it as empty."""
    survey = {'id': 1, 'form_json': _nested_wizard()}
    submission = {
        'id': 10,
        'participant_id': 5,
        'submission_json': {'simpleradios1': 'other', 'simpletextfield1': 'I live on a boat'},
    }

    comments = CommentService.extract_comments_from_survey(submission, survey)

    assert [(c['component_id'], c['text']) for c in comments] == [('simpletextfield1', 'I live on a boat')]


def test_comment_titles_include_a_question_nested_in_a_panel():
    """The exported comment sheet needs a column for the nested question too."""

    class _Survey:  # pylint: disable=too-few-public-methods
        form_json = _nested_wizard()

    assert CommentService.get_titles(_Survey()) == [{'label': 'Please specify'}]

import { groupReportSettingsByPage } from 'components/admin/survey/building/groupReportSettingsByPage';
import { SurveyReportSetting } from 'models/surveyReportSetting';
import { FormBuilderData } from 'components/shared/form/FormBuilder/types';
import { ConditionalLink } from 'components/public/dashboard/surveyPages';

const baseSetting: SurveyReportSetting = {
    id: 1,
    survey_id: 1,
    question_id: 1,
    question_key: 'radio1',
    question_type: 'simpleradios',
    question: 'Pick one',
    display: true,
};

const followUpSetting: SurveyReportSetting = {
    id: 2,
    survey_id: 1,
    question_id: 2,
    question_key: 'other1',
    question_type: 'simpletextfield',
    question: 'Please specify',
    display: true,
};

const formDefinition: FormBuilderData = {
    display: 'form',
    components: [
        { id: '1', key: 'radio1', title: 'Pick one' },
        { id: '2', key: 'other1', title: 'Please specify' },
    ],
};

const conditionalLink: ConditionalLink = {
    trigger_key: 'radio1',
    row_key: null,
    row_label: null,
    trigger_values: ['other'],
    trigger_value_labels: ['Other'],
};

describe('groupReportSettingsByPage', () => {
    test('nests a conditional follow-up under its trigger question instead of listing it standalone', () => {
        const pages = groupReportSettingsByPage(formDefinition, [baseSetting, followUpSetting], {
            other1: conditionalLink,
        });

        expect(pages).toHaveLength(1);
        expect(pages[0].items).toHaveLength(1);
        expect(pages[0].items[0].setting.question_key).toBe('radio1');
        expect(pages[0].items[0].followUps).toHaveLength(1);
        expect(pages[0].items[0].followUps[0].question_key).toBe('other1');
    });

    test('with no conditional links, every setting is its own top-level item', () => {
        const pages = groupReportSettingsByPage(formDefinition, [baseSetting, followUpSetting]);

        expect(pages[0].items).toHaveLength(2);
        expect(pages[0].items.every((item) => item.followUps.length === 0)).toBe(true);
    });

    test('falls back to a standalone item when the trigger question is missing from the page', () => {
        const pages = groupReportSettingsByPage(formDefinition, [followUpSetting], {
            other1: conditionalLink,
        });

        expect(pages[0].items).toHaveLength(1);
        expect(pages[0].items[0].setting.question_key).toBe('other1');
        expect(pages[0].items[0].followUps).toHaveLength(0);
    });
});

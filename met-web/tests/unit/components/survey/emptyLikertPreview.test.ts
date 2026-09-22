import { buildEmptyLikertQuestion } from 'components/admin/survey/building/emptyLikertPreview';
import { FormBuilderData } from 'components/shared/form/FormBuilder/types';
import { SurveyReportSetting } from 'models/surveyReportSetting';

const setting: SurveyReportSetting = {
    id: 1,
    survey_id: 1,
    question_id: 'eved9vq' as unknown as number,
    question_key: 'simplesurvey',
    question_type: 'simplesurvey',
    question: 'Likert',
    display: true,
};

// Stored out of rank order on purpose: the backend sorts by classification, not by stored order.
const likertComponent = {
    id: 'eved9vq',
    key: 'simplesurvey',
    type: 'simplesurvey',
    label: 'Likert',
    questions: [{ label: 'pizza?', value: 'pizza' }],
    values: [
        { label: 'meh', value: 'meh', classification: 'neutral' },
        { label: 'idk', value: 'idk', classification: 'notSure' },
        { label: 'bad', value: 'bad', classification: 'neg1' },
        { label: 'good', value: 'good', classification: 'pos1' },
    ],
};

const formWith = (component: Record<string, unknown>): FormBuilderData => ({
    display: 'wizard',
    components: [{ id: 'page1', title: 'Page 1', type: 'panel', components: [component] }],
});

describe('buildEmptyLikertQuestion', () => {
    it('builds a zeroed matrix with the scale in rank order and Not sure split off', () => {
        const question = buildEmptyLikertQuestion(formWith(likertComponent), setting);

        expect(question).not.toBeNull();
        expect(question?.scale_labels).toEqual(['bad', 'meh', 'good']);
        expect(question?.scale).toEqual([
            { label: 'bad', classification: 'neg1' },
            { label: 'meh', classification: 'neutral' },
            { label: 'good', classification: 'pos1' },
        ]);
        expect(question?.has_not_sure).toBe(true);
        expect(question?.respondent_count).toBe(0);
        expect(question?.result).toEqual([{ label: 'pizza?', pcts: [0, 0, 0], n: 0, not_sure_pct: 0 }]);
    });

    it('keeps the stored order and drops Not sure when a classification is duplicated', () => {
        const duplicated = {
            ...likertComponent,
            values: [
                { label: 'bad', value: 'bad', classification: 'neg1' },
                { label: 'worse', value: 'worse', classification: 'neg1' },
                { label: 'idk', value: 'idk', classification: 'notSure' },
            ],
        };

        const question = buildEmptyLikertQuestion(formWith(duplicated), setting);

        expect(question?.scale_labels).toEqual(['bad', 'worse', 'idk']);
        expect(question?.has_not_sure).toBe(false);
        expect(question?.result).toEqual([{ label: 'pizza?', pcts: [0, 0, 0], n: 0, not_sure_pct: null }]);
    });

    it('keeps the stored order when a classification is unknown', () => {
        const unknown = {
            ...likertComponent,
            values: [
                { label: 'bad', value: 'bad', classification: 'neg1' },
                { label: 'mystery', value: 'mystery', classification: 'sideways' },
            ],
        };

        const question = buildEmptyLikertQuestion(formWith(unknown), setting);

        expect(question?.scale_labels).toEqual(['bad', 'mystery']);
        expect(question?.has_not_sure).toBe(false);
    });

    // Likert questions saved before classifications existed carry no classification key at all.
    it('keeps a legacy five-point scale in its stored order with no Not sure column', () => {
        const legacy = {
            ...likertComponent,
            values: [
                { label: 'Strongly disagree', value: 'stronglyDisagree' },
                { label: 'Disagree', value: 'disagree' },
                { label: 'Neither agree nor disagree', value: 'neither' },
                { label: 'Agree', value: 'agree' },
                { label: 'Strongly agree', value: 'stronglyAgree' },
            ],
        };

        const question = buildEmptyLikertQuestion(formWith(legacy), setting);

        expect(question?.scale_labels).toEqual([
            'Strongly disagree',
            'Disagree',
            'Neither agree nor disagree',
            'Agree',
            'Strongly agree',
        ]);
        expect(question?.scale?.every((point) => point.classification === null)).toBe(true);
        expect(question?.has_not_sure).toBe(false);
        expect(question?.result).toEqual([
            { label: 'pizza?', pcts: [0, 0, 0, 0, 0], n: 0, not_sure_pct: null },
        ]);
    });

    it('keeps a legacy scale of any length in its stored order', () => {
        const legacyFour = {
            ...likertComponent,
            values: [
                { label: 'Never', value: 'never' },
                { label: 'Sometimes', value: 'sometimes' },
                { label: 'Often', value: 'often' },
                { label: 'Always', value: 'always' },
            ],
        };

        const question = buildEmptyLikertQuestion(formWith(legacyFour), setting);

        expect(question?.scale_labels).toEqual(['Never', 'Sometimes', 'Often', 'Always']);
        expect(question?.result).toEqual([{ label: 'pizza?', pcts: [0, 0, 0, 0], n: 0, not_sure_pct: null }]);
    });

    it('builds a row for every question in the matrix', () => {
        const twoRows = {
            ...likertComponent,
            questions: [
                { label: 'pizza?', value: 'pizza' },
                { label: 'pasta?', value: 'pasta' },
            ],
        };

        const question = buildEmptyLikertQuestion(formWith(twoRows), setting);

        expect(question?.result.map((row) => (row as { label: string }).label)).toEqual(['pizza?', 'pasta?']);
    });

    it('returns null when the matrix has no question rows', () => {
        expect(buildEmptyLikertQuestion(formWith({ ...likertComponent, questions: [] }), setting)).toBeNull();
    });

    it('returns null when the matrix has no scale values', () => {
        expect(buildEmptyLikertQuestion(formWith({ ...likertComponent, values: [] }), setting)).toBeNull();
    });

    it('returns null for a question that is not a Likert matrix', () => {
        const radios = { ...setting, question_type: 'simpleradios' };

        expect(buildEmptyLikertQuestion(formWith(likertComponent), radios)).toBeNull();
    });

    it('returns null when the component is no longer in the form', () => {
        const missing = { ...setting, question_id: 'gone' as unknown as number };

        expect(buildEmptyLikertQuestion(formWith(likertComponent), missing)).toBeNull();
    });
});

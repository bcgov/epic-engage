import { buildQuestionGroups, buildResultPages } from 'components/public/dashboard/surveyPages';
import { TypedSurveyData } from 'models/analytics/surveyResult';

const question = (key: string, position: number, type = 'simpleradios'): TypedSurveyData => ({
    key,
    position,
    label: `Question ${key}`,
    type,
    result: [{ value: 'Yes', count: 1 }],
});

describe('dashboard survey pages', () => {
    it('keeps questions in the order the analytics api returns them', () => {
        const questions = [question('age', 1), question('gender', 2), question('location', 3)];

        const groups = buildQuestionGroups(questions);

        expect(groups.map((group) => group.question.key)).toEqual(['age', 'gender', 'location']);
    });

    it('nests a conditional question under the question it depends on', () => {
        const questions = [question('location', 1), question('locationOther', 2, 'simpletextfield')];
        const conditionals = [{ key: 'locationOther', when: 'location', eq: 'Other' }];

        const groups = buildQuestionGroups(questions, conditionals);

        expect(groups).toHaveLength(1);
        expect(groups[0].question.key).toBe('location');
        expect(groups[0].conditionals).toEqual([{ question: questions[1], eq: 'Other' }]);
    });

    it('keeps a conditional question standalone when its parent question has no results', () => {
        const questions = [question('locationOther', 2, 'simpletextfield')];
        const conditionals = [{ key: 'locationOther', when: 'location', eq: 'Other' }];

        const groups = buildQuestionGroups(questions, conditionals);

        expect(groups.map((group) => group.question.key)).toEqual(['locationOther']);
        expect(groups[0].conditionals).toEqual([]);
    });

    it('groups results into the wizard pages of the survey', () => {
        const questions = [question('age', 1), question('other', 2, 'simpletextfield'), question('rank', 3)];
        const form = {
            id: 1,
            display: 'wizard',
            pages: [
                { title: 'Demographics', questions: ['age', 'other'] },
                { title: 'Priorities', questions: ['rank'] },
            ],
            conditionals: [{ key: 'other', when: 'age', eq: 'Prefer not to say' }],
        };

        const pages = buildResultPages(form, questions);

        expect(pages).not.toBeNull();
        expect(pages?.map((page) => page.title)).toEqual(['Demographics', 'Priorities']);
        expect(pages?.[0].questions).toHaveLength(1);
        expect(pages?.[0].questions[0].conditionals[0].question.key).toBe('other');
        expect(pages?.[1].questions.map((group) => group.question.key)).toEqual(['rank']);
    });

    it('returns no pages for a survey that is not a wizard', () => {
        expect(buildResultPages({ id: 1, display: 'form', pages: [] }, [question('age', 1)])).toBeNull();
        expect(buildResultPages(undefined, [question('age', 1)])).toBeNull();
    });
});

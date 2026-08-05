import { buildResultPages, DashboardSurveyForm } from 'components/public/dashboard/surveyPages';
import { TypedSurveyData } from 'models/analytics/surveyResult';

const question = (key: string, position = 0): TypedSurveyData => ({
    label: key,
    position,
    key,
    type: 'simpleradios',
    result: [{ value: 'yes', count: 1 }],
});

describe('buildResultPages', () => {
    it('returns null when the form is undefined', () => {
        expect(buildResultPages(undefined, [question('q1')])).toBeNull();
    });

    it('returns null when the form is not a wizard', () => {
        const form: DashboardSurveyForm = { id: 1, display: 'form', pages: [] };
        expect(buildResultPages(form, [question('q1')])).toBeNull();
    });

    it('returns null when display is wizard but there are no pages', () => {
        const form: DashboardSurveyForm = { id: 1, display: 'wizard', pages: [] };
        expect(buildResultPages(form, [question('q1')])).toBeNull();
    });

    it('groups questions into their wizard pages by key', () => {
        const form: DashboardSurveyForm = {
            id: 1,
            display: 'wizard',
            pages: [
                { title: 'Page 1', questions: ['q1', 'q2'] },
                { title: 'Page 2', questions: ['q3'] },
            ],
        };
        const questions = [question('q1'), question('q2'), question('q3')];

        const pages = buildResultPages(form, questions);

        expect(pages).toEqual([
            { title: 'Page 1', questions: [question('q1'), question('q2')], keys: ['q1', 'q2'] },
            { title: 'Page 2', questions: [question('q3')], keys: ['q3'] },
        ]);
    });

    it('omits questions that have no analytics data for a page, without dropping the page', () => {
        const form: DashboardSurveyForm = {
            id: 1,
            display: 'wizard',
            pages: [{ title: 'Page 1', questions: ['q1', 'q2'] }],
        };
        // q2 never synced to analytics (e.g. a free-text question) - only q1 has result data
        const pages = buildResultPages(form, [question('q1')]);

        expect(pages).toEqual([{ title: 'Page 1', questions: [question('q1')], keys: ['q1', 'q2'] }]);
    });

    it('produces an empty questions list for a page whose keys have no matching data at all', () => {
        const form: DashboardSurveyForm = {
            id: 1,
            display: 'wizard',
            pages: [{ title: 'Empty page', questions: ['q1'] }],
        };

        const pages = buildResultPages(form, []);

        expect(pages).toEqual([{ title: 'Empty page', questions: [], keys: ['q1'] }]);
    });
});

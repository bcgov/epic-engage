import { buildCommentSections } from 'components/public/dashboard/comments/buildCommentSections';
import { ResultPage } from 'components/public/dashboard/surveyPages';

describe('buildCommentSections', () => {
    test('returns an empty list when there are no pages', () => {
        expect(buildCommentSections(null)).toEqual([]);
    });

    test('ignores pages with no free-text questions', () => {
        const pages: ResultPage[] = [
            {
                title: 'Demographics',
                questions: [
                    { label: 'Age', position: 0, key: 'age', type: 'simpleradios', result: [] },
                ],
            },
        ];
        expect(buildCommentSections(pages)).toEqual([]);
    });

    test('a page with a single free-text question becomes a section titled with the question label', () => {
        const pages: ResultPage[] = [
            {
                title: 'Page 1 - Demographics',
                questions: [
                    {
                        label: 'Tell us more about your connection to the project area.',
                        position: 0,
                        key: 'location-other',
                        type: 'simpletextarea',
                        result: [
                            { value: 'I live nearby', count: 1 },
                            { value: 'I work in the area', count: 1 },
                        ],
                    },
                ],
            },
        ];

        const sections = buildCommentSections(pages);
        expect(sections).toHaveLength(1);
        expect(sections[0]).toMatchObject({
            title: 'Tell us more about your connection to the project area.',
            pageTitle: 'Page 1 - Demographics',
            commentCount: 2,
            responses: ['I live nearby', 'I work in the area'],
        });
        expect(sections[0].subSections).toBeUndefined();
    });

    test('a page with multiple free-text questions becomes one section with sub-sections', () => {
        const pages: ResultPage[] = [
            {
                title: 'Page 3 - Valued Components',
                questions: [
                    {
                        label: 'Why is Air Quality important to you?',
                        position: 0,
                        key: 'valued-air-quality',
                        type: 'simpletextarea',
                        result: [{ value: 'Health concerns', count: 1 }],
                    },
                    {
                        label: 'Why is Water Quality important to you?',
                        position: 1,
                        key: 'valued-water-quality',
                        type: 'simpletextarea',
                        result: [
                            { value: 'Drinking water source', count: 1 },
                            { value: 'Fishing', count: 1 },
                        ],
                    },
                ],
            },
        ];

        const sections = buildCommentSections(pages);
        expect(sections).toHaveLength(1);
        const [section] = sections;
        expect(section.title).toBe('Page 3 - Valued Components');
        expect(section.commentCount).toBe(3);
        expect(section.responses).toBeUndefined();
        expect(section.subSections).toHaveLength(2);
        expect(section.subSections?.[0]).toMatchObject({
            label: 'Why is Air Quality important to you?',
            responses: ['Health concerns'],
        });
        expect(section.subSections?.[1]).toMatchObject({
            label: 'Why is Water Quality important to you?',
            responses: ['Drinking water source', 'Fishing'],
        });
    });

    test('a blank-titled fallback page (non-wizard form) gives each free-text question its own section', () => {
        // CommentsTab falls back to a single page with title '' wrapping the whole flat
        // result list when the survey isn't a multi-page wizard - these should NOT get
        // lumped together as sub-sections just because there's more than one of them.
        const pages: ResultPage[] = [
            {
                title: '',
                questions: [
                    {
                        label: 'What did you think of the project?',
                        position: 0,
                        key: 'q1',
                        type: 'simpletextarea',
                        result: [{ value: 'Looks good', count: 1 }],
                    },
                    {
                        label: 'Any other comments?',
                        position: 1,
                        key: 'q2',
                        type: 'simpletextfield',
                        result: [{ value: 'Nope', count: 1 }],
                    },
                ],
            },
        ];

        const sections = buildCommentSections(pages);
        expect(sections).toHaveLength(2);
        expect(sections[0]).toMatchObject({ title: 'What did you think of the project?', responses: ['Looks good'] });
        expect(sections[1]).toMatchObject({ title: 'Any other comments?', responses: ['Nope'] });
        expect(sections[0].subSections).toBeUndefined();
        expect(sections[1].subSections).toBeUndefined();
    });

    test('filters out empty responses', () => {
        const pages: ResultPage[] = [
            {
                title: 'Page 5 - Project Design',
                questions: [
                    {
                        label: 'Any additional comments?',
                        position: 0,
                        key: 'design-comments',
                        type: 'simpletextfield',
                        result: [
                            { value: 'Great project', count: 1 },
                            { value: '', count: 1 },
                        ],
                    },
                ],
            },
        ];

        const sections = buildCommentSections(pages);
        expect(sections[0].responses).toEqual(['Great project']);
        expect(sections[0].commentCount).toBe(1);
    });
});

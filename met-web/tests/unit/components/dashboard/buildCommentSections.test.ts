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
                questions: [{ label: 'Age', position: 0, key: 'age', type: 'simpleradios', result: [] }],
                keys: ['age'],
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
                keys: ['location-other'],
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

    test('a page with several ordinary free-text questions gives each its own section', () => {
        const pages: ResultPage[] = [
            {
                title: 'Page 5 - Project Design',
                questions: [
                    {
                        label: 'Any additional comments about the design?',
                        position: 0,
                        key: 'design-comments',
                        type: 'simpletextarea',
                        result: [{ value: 'Looks solid', count: 1 }],
                    },
                    {
                        label: 'Any suggestions for improving the survey?',
                        position: 1,
                        key: 'survey-feedback',
                        type: 'simpletextarea',
                        result: [{ value: 'Shorter please', count: 1 }],
                    },
                ],
                keys: ['design-comments', 'survey-feedback'],
            },
        ];

        // Sharing a page is not a reason to nest - the wireframe reserves the all-caps sub-labels
        // for a conditional's per-row breakdown, and these are ordinary questions.
        const sections = buildCommentSections(pages);
        expect(sections).toHaveLength(2);
        expect(sections[0]).toMatchObject({
            title: 'Any additional comments about the design?',
            responses: ['Looks solid'],
        });
        expect(sections[1]).toMatchObject({
            title: 'Any suggestions for improving the survey?',
            responses: ['Shorter please'],
        });
        expect(sections[0].subSections).toBeUndefined();
        expect(sections[1].subSections).toBeUndefined();
    });

    test('a conditional follow-up repeated per matrix row becomes one section with a row per sub-section', () => {
        const pages: ResultPage[] = [
            {
                title: 'Page 3 - Valued Components',
                questions: [
                    {
                        label: 'Why is this component important to you?',
                        position: 0,
                        key: 'valued-air-quality',
                        type: 'simpletextarea',
                        result: [{ value: 'Health concerns', count: 1 }],
                    },
                    {
                        label: 'Why is this component important to you?',
                        position: 1,
                        key: 'valued-water-quality',
                        type: 'simpletextarea',
                        result: [
                            { value: 'Drinking water source', count: 1 },
                            { value: 'Fishing', count: 1 },
                        ],
                    },
                ],
                keys: ['valued-air-quality', 'valued-water-quality'],
            },
        ];
        const conditionalLinks = {
            'valued-air-quality': {
                trigger_key: 'valued-components',
                row_key: 'air',
                row_label: 'Air quality',
                trigger_values: ['very-important'],
                trigger_value_labels: ['Very important'],
            },
            'valued-water-quality': {
                trigger_key: 'valued-components',
                row_key: 'water',
                row_label: 'Water quality',
                trigger_values: ['very-important'],
                trigger_value_labels: ['Very important'],
            },
        };

        const sections = buildCommentSections(pages, conditionalLinks);
        expect(sections).toHaveLength(1);
        const [section] = sections;
        // Titled with the question, not the page - the rows are what the sub-sections carry.
        expect(section.title).toBe('Why is this component important to you?');
        expect(section.pageTitle).toBe('Page 3 - Valued Components');
        expect(section.commentCount).toBe(3);
        expect(section.responses).toBeUndefined();
        expect(section.subSections).toHaveLength(2);
        expect(section.subSections?.[0]).toMatchObject({
            label: 'Air quality',
            responses: ['Health concerns'],
        });
        expect(section.subSections?.[1]).toMatchObject({
            label: 'Water quality',
            responses: ['Drinking water source', 'Fishing'],
        });
    });

    test('follow-ups on different conditions or with different wording stay separate sections', () => {
        const question = (key: string, label: string): ResultPage['questions'][number] => ({
            label,
            position: 0,
            key,
            type: 'simpletextarea',
            result: [{ value: 'A comment', count: 1 }],
        });
        const pages: ResultPage[] = [
            {
                title: 'Page 4 - Effects',
                questions: [
                    question('why-air', 'Why is this component important to you?'),
                    question('concerns-water', 'What concerns you about this component?'),
                    question('why-noise', 'Why is this component important to you?'),
                ],
                keys: ['why-air', 'concerns-water', 'why-noise'],
            },
        ];
        const link = (rowLabel: string, triggerValue: string) => ({
            trigger_key: 'effects',
            row_key: rowLabel.toLowerCase(),
            row_label: rowLabel,
            trigger_values: [triggerValue],
            trigger_value_labels: [triggerValue],
        });
        const conditionalLinks = {
            'why-air': { ...link('Air quality', 'very-important'), trigger_label: 'Which components matter?' },
            // Same trigger and answer - grouped with the one above however its wording differs.
            'concerns-water': {
                ...link('Water quality', 'very-important'),
                trigger_label: 'Which components matter?',
            },
            // A different answer reveals this one, so it is a condition of its own.
            'why-noise': { ...link('Noise', 'somewhat-important'), trigger_label: 'Which components matter?' },
        };

        const sections = buildCommentSections(pages, conditionalLinks);
        expect(sections).toHaveLength(2);
        // No single follow-up speaks for a group whose wording varies, so the trigger question does.
        expect(sections[0].title).toBe('Which components matter?');
        expect(sections[0].subSections?.map((sub) => sub.label)).toEqual([
            'Air quality: Why is this component important to you?',
            'Water quality: What concerns you about this component?',
        ]);
        // Revealed by a different answer, so it never joins them.
        expect(sections[1]).toMatchObject({ title: 'Why is this component important to you?' });
        expect(sections[1].subSections).toBeUndefined();
    });

    test('per-row follow-ups merge on their condition alone, not on matching wording', () => {
        // The Survey Results tab groups follow-ups by trigger and answer; the Comments tab has to
        // reach the same shape or a survey nests in one tab and reads flat in the other.
        const question = (key: string, label: string): ResultPage['questions'][number] => ({
            label,
            position: 0,
            key,
            type: 'simpletextarea',
            result: [{ value: 'A comment', count: 1 }],
        });
        const pages: ResultPage[] = [
            {
                title: 'Valued Components',
                questions: [
                    question('air', 'Why is air quality important to you?'),
                    question('water', 'Why is water quality important to you?'),
                ],
                keys: ['air', 'water'],
            },
        ];
        // A ticked checkbox option reports 'true' whichever option it is - that shared value is
        // what collects the follow-ups, and their tailored wording must not break it up.
        const link = (rowKey: string, rowLabel: string) => ({
            trigger_key: 'simplecheckboxes1',
            trigger_label: 'Which components matter to you?',
            row_key: rowKey,
            row_label: rowLabel,
            trigger_values: ['true'],
            trigger_value_labels: ['Selected'],
        });

        const sections = buildCommentSections(pages, {
            air: link('airQuality', 'Air quality'),
            water: link('waterQuality', 'Water quality'),
        });

        expect(sections).toHaveLength(1);
        expect(sections[0]).toMatchObject({ title: 'Which components matter to you?', commentCount: 2 });
        expect(sections[0].subSections?.map((sub) => sub.label)).toEqual([
            'Air quality: Why is air quality important to you?',
            'Water quality: Why is water quality important to you?',
        ]);
    });

    test('a follow-up not tied to a matrix row stays a section of its own', () => {
        const pages: ResultPage[] = [
            {
                title: 'Page 2 - Outreach',
                questions: [
                    {
                        label: 'Please tell us how you heard about this survey.',
                        position: 0,
                        key: 'heard-other',
                        type: 'simpletextfield',
                        result: [{ value: 'A neighbour', count: 1 }],
                    },
                ],
                keys: ['heard-other'],
            },
        ];
        // row_label is null when a plain radio triggers the follow-up - there are no rows to break
        // the responses down by.
        const conditionalLinks = {
            'heard-other': {
                trigger_key: 'heard-about',
                row_key: null,
                row_label: null,
                trigger_values: ['other'],
                trigger_value_labels: ['Other'],
            },
        };

        const sections = buildCommentSections(pages, conditionalLinks);
        expect(sections).toHaveLength(1);
        expect(sections[0]).toMatchObject({
            title: 'Please tell us how you heard about this survey.',
            responses: ['A neighbour'],
        });
        expect(sections[0].subSections).toBeUndefined();
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
                keys: ['q1', 'q2'],
            },
        ];

        const sections = buildCommentSections(pages);
        expect(sections).toHaveLength(2);
        expect(sections[0]).toMatchObject({ title: 'What did you think of the project?', responses: ['Looks good'] });
        expect(sections[1]).toMatchObject({ title: 'Any other comments?', responses: ['Nope'] });
        expect(sections[0].subSections).toBeUndefined();
        expect(sections[1].subSections).toBeUndefined();
    });

    test('numbers sections by their page position in the survey, not by section order', () => {
        const freeText = (key: string, label: string): ResultPage['questions'][number] => ({
            label,
            position: 0,
            key,
            type: 'simpletextarea',
            result: [{ value: 'A comment', count: 1 }],
        });
        const pages: ResultPage[] = [
            // Pages 1 and 3 carry no comments, but respondents still counted through them.
            {
                title: 'Demographics',
                questions: [{ label: 'Age', position: 0, key: 'age', type: 'simpleradios', result: [] }],
                keys: ['age'],
            },
            { title: 'Outreach', questions: [freeText('heard', 'How did you hear about this?')], keys: ['heard'] },
            {
                title: 'Ratings',
                questions: [{ label: 'Rate it', position: 0, key: 'rate', type: 'simpleradios', result: [] }],
                keys: ['rate'],
            },
            {
                title: 'Project Design',
                questions: [freeText('design', 'Any comments on the design?')],
                keys: ['design'],
            },
        ];

        const sections = buildCommentSections(pages);
        expect(sections.map((section) => [section.pageNumber, section.pageTitle])).toEqual([
            [2, 'Outreach'],
            [4, 'Project Design'],
        ]);
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
                keys: ['design-comments'],
            },
        ];

        const sections = buildCommentSections(pages);
        expect(sections[0].responses).toEqual(['Great project']);
        expect(sections[0].commentCount).toBe(1);
    });
});

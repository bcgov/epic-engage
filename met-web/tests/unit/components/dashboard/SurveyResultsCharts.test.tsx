import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SurveyResultsCharts } from 'components/public/dashboard/SurveyResultsCharts';
import * as useSurveyResultPagesModule from 'components/public/dashboard/hooks/useSurveyResultPages';
import * as useSurveyCommentsModule from 'components/public/dashboard/hooks/useSurveyComments';
import { openEngagement } from '../factory';
import { TypedSurveyData } from 'models/analytics/surveyResult';

jest.mock('components/public/dashboard/hooks/useSurveyResultPages');
jest.mock('components/public/dashboard/hooks/useSurveyComments');

jest.mock('components/public/dashboard/charts', () => ({
    DonutChart: ({ total }: { total: number }) => <div data-testid="donut-chart">{total}</div>,
    LikertChart: () => <div data-testid="likert-chart" />,
    RankOrderChart: () => <div data-testid="rank-order-chart" />,
    CheckboxChart: ({ question, children }: { question: string; children?: React.ReactNode }) => (
        <div data-testid="checkbox-chart">
            {question}
            {children}
        </div>
    ),
    Comments: ({ question, responses }: { question: string; responses: string[] }) => (
        <div data-testid="comments">
            {question}: {responses.join(', ')}
        </div>
    ),
    ConditionalFollowUp: ({
        conditionLabel,
        sections,
        countLabel,
    }: {
        conditionLabel: string;
        sections: { rowLabel?: string; question: string }[];
        countLabel: string;
    }) => (
        <div data-testid="conditional-follow-up">
            {conditionLabel} | {countLabel} |{' '}
            {sections
                .map((section) => `${section.rowLabel ? `${section.rowLabel}: ` : ''}${section.question}`)
                .join(', ')}
        </div>
    ),
}));

jest.mock('components/public/survey/submit/Stepper', () => ({
    __esModule: true,
    default: ({ onStepClick }: { onStepClick: (i: number) => void }) => (
        <button data-testid="stepper" onClick={() => onStepClick(1)}>
            stepper
        </button>
    ),
}));

const mockUseSurveyResultPages = useSurveyResultPagesModule.useSurveyResultPages as jest.Mock;
const mockUseSurveyComments = useSurveyCommentsModule.useSurveyComments as jest.Mock;

const baseHookResult = {
    data: null,
    pages: null,
    conditionalLinks: {},
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
};

const radioQuestion: TypedSurveyData = {
    label: 'Favourite colour?',
    position: 0,
    key: 'radio1',
    type: 'simpleradios',
    result: [
        { value: 'red', count: 3 },
        { value: 'blue', count: 1 },
    ],
};

const setupHooks = (resultOverrides = {}, commentsOverrides = {}) => {
    mockUseSurveyResultPages.mockReturnValue({ ...baseHookResult, ...resultOverrides });
    mockUseSurveyComments.mockReturnValue({ ...baseHookResult, ...commentsOverrides });
};

describe('SurveyResultsCharts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows loading skeletons while either hook is loading', () => {
        setupHooks({ isLoading: true });
        const { container } = render(
            <SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />,
        );
        expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    });

    it('shows an error box when either hook errors, and refetches both on click', () => {
        const refetch = jest.fn();
        const refetchComments = jest.fn();
        setupHooks({ isError: true, refetch }, { refetch: refetchComments });

        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        fireEvent.click(screen.getByRole('button'));
        expect(refetch).toHaveBeenCalled();
        expect(refetchComments).toHaveBeenCalled();
    });

    it('shows NoData when neither results nor comments have any data', () => {
        setupHooks();
        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);
        expect(screen.getByText(/no data/i)).toBeInTheDocument();
    });

    it('renders a chart for a flat (non-matrix) question using the non-paged fallback', () => {
        setupHooks({ data: { data: [radioQuestion] } });
        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        expect(screen.getByTestId('donut-chart')).toBeInTheDocument();
        expect(screen.getByText('Favourite colour?')).toBeInTheDocument();
    });

    it('falls back to the summed responses when a donut question reports no respondents', () => {
        // Rows synced before the ETL recorded participant_id come back with respondent_count 0,
        // which used to leave the donut centre reading "0".
        setupHooks({ data: { data: [{ ...radioQuestion, respondent_count: 0 }] } });
        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        expect(screen.getByTestId('donut-chart')).toHaveTextContent('4');
        // The count belongs in the donut's centre only, never as a line under the title.
        expect(screen.queryByText(/respondents/)).not.toBeInTheDocument();
    });

    it('prefers the reported respondent count over the summed responses', () => {
        setupHooks({ data: { data: [{ ...radioQuestion, respondent_count: 9 }] } });
        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        expect(screen.getByTestId('donut-chart')).toHaveTextContent('9');
    });

    it('routes checkbox and free-text questions to their dedicated chart components', () => {
        const checkboxQuestion: TypedSurveyData = {
            label: 'Pick your interests',
            position: 0,
            key: 'checkbox1',
            type: 'simplecheckboxes',
            result: [{ value: 'sports', count: 2 }],
        };
        const textQuestion: TypedSurveyData = {
            label: 'Tell us more',
            position: 1,
            key: 'text1',
            type: 'simpletextarea',
            result: [{ value: 'Great project', count: 1 }],
        };
        setupHooks({ data: { data: [checkboxQuestion, textQuestion] } });

        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        expect(screen.getByTestId('checkbox-chart')).toHaveTextContent('Pick your interests');
        expect(screen.getByTestId('comments')).toHaveTextContent('Tell us more: Great project');
    });

    it('interleaves an analytics chart question and a live comment question on the same (non-paged) view', () => {
        setupHooks(
            { data: { data: [radioQuestion] } },
            {
                data: {
                    data: [
                        {
                            label: 'Tell us more',
                            position: 1,
                            key: 'text1',
                            type: 'simpletextarea',
                            result: [{ value: 'Great project', count: 1 }],
                        },
                    ],
                },
            },
        );

        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        expect(screen.getByTestId('donut-chart')).toBeInTheDocument();
        expect(screen.getByTestId('comments')).toHaveTextContent('Tell us more: Great project');
    });

    it('shows a stale-format notice for an orphaned matrix sub-question with no rows', () => {
        const orphanedMatrixChild: TypedSurveyData = {
            label: 'Row A',
            position: 0,
            key: 'likert1-1',
            type: 'simplesurvey',
            result: [{ value: 'agree', count: 1 }], // flat result => not a matrix row => stale
        };
        setupHooks({ data: { data: [orphanedMatrixChild] } });

        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        expect(screen.getByText(/has not been updated to a format compatible/i)).toBeInTheDocument();
    });

    it('groups a conditionally-shown follow-up under its trigger question instead of showing it standalone', () => {
        const trigger: TypedSurveyData = {
            label: 'How do you feel?',
            position: 0,
            key: 'radio1',
            type: 'simpleradios',
            result: [{ value: 'other', count: 2 }],
        };
        const followUpComment: TypedSurveyData = {
            label: 'Please elaborate',
            position: 1,
            key: 'followup1',
            type: 'simpletextarea',
            result: [{ value: 'more detail', count: 1 }],
        };
        setupHooks(
            {
                data: { data: [trigger] },
                conditionalLinks: {
                    followup1: {
                        trigger_key: 'radio1',
                        row_key: null,
                        row_label: null,
                        trigger_values: ['other'],
                        trigger_value_labels: ['Other'],
                    },
                },
            },
            { data: { data: [followUpComment] } },
        );

        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        // The follow-up is rendered nested (as a ConditionalFollowUp), not as its own standalone Comments chart.
        expect(screen.getByTestId('conditional-follow-up')).toHaveTextContent('Please elaborate');
        expect(screen.getByTestId('conditional-follow-up')).toHaveTextContent(
            'Conditional — shown to respondents who selected "Other"',
        );
        expect(screen.queryByTestId('comments')).not.toBeInTheDocument();
    });

    it('merges per-row follow-ups shown on the same answer into a single conditional block', () => {
        const likert: TypedSurveyData = {
            label: 'How important are these to you?',
            position: 0,
            key: 'simplesurvey1',
            type: 'simplesurvey',
            result: [
                { label: 'Air quality', pcts: [10, 90], n: 10 },
                { label: 'Wildlife', pcts: [20, 80], n: 10 },
            ],
        };
        const link = (rowKey: string, rowLabel: string) => ({
            trigger_key: 'simplesurvey1',
            row_key: rowKey,
            row_label: rowLabel,
            trigger_values: ['important', 'mostImportant'],
            trigger_value_labels: ['Important', 'Most important'],
        });
        const followUp = (key: string, label: string): TypedSurveyData => ({
            label,
            position: 1,
            key,
            type: 'simpletextarea',
            result: [{ value: 'a comment', count: 1 }],
        });
        setupHooks(
            {
                data: { data: [likert] },
                conditionalLinks: {
                    followupAir: link('airQuality', 'Air quality'),
                    followupWildlife: link('wildlife', 'Wildlife'),
                },
            },
            {
                data: {
                    data: [
                        followUp('followupAir', 'Why is air quality important to you?'),
                        followUp('followupWildlife', 'Why is wildlife important to you?'),
                    ],
                },
            },
        );

        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        const blocks = screen.getAllByTestId('conditional-follow-up');
        expect(blocks).toHaveLength(1);
        expect(blocks[0]).toHaveTextContent(
            'Conditional — shown to respondents who answered "Important" or "Most important" for any row',
        );
        expect(blocks[0]).toHaveTextContent('comments across all rows');
        expect(blocks[0]).toHaveTextContent('Air quality: Why is air quality important to you?');
        expect(blocks[0]).toHaveTextContent('Wildlife: Why is wildlife important to you?');
    });

    it('merges per-option follow-ups under a checkbox trigger and names the option, not the tick', () => {
        const checkbox: TypedSurveyData = {
            label: 'Which components matter to you?',
            position: 0,
            key: 'simplecheckboxes1',
            type: 'simplecheckboxes',
            result: [
                { value: 'Air quality', count: 9 },
                { value: 'Water quality', count: 6 },
            ],
        };
        // Every ticked option reports the same 'true', which is what merges the follow-ups.
        const link = (rowKey: string, rowLabel: string) => ({
            trigger_key: 'simplecheckboxes1',
            row_key: rowKey,
            row_label: rowLabel,
            trigger_values: ['true'],
            trigger_value_labels: ['Selected'],
        });
        const followUp = (key: string): TypedSurveyData => ({
            label: 'Why is this component important to you?',
            position: 1,
            key,
            type: 'simpletextarea',
            result: [{ value: 'a comment', count: 1 }],
        });
        setupHooks(
            {
                data: { data: [checkbox] },
                conditionalLinks: {
                    followupAir: link('airQuality', 'Air quality'),
                    followupWater: link('waterQuality', 'Water quality'),
                },
            },
            { data: { data: [followUp('followupAir'), followUp('followupWater')] } },
        );

        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        const blocks = screen.getAllByTestId('conditional-follow-up');
        expect(blocks).toHaveLength(1);
        expect(blocks[0]).toHaveTextContent('Conditional — shown to respondents who selected any of these options');
        expect(blocks[0]).toHaveTextContent('comments across all options');
        expect(blocks[0]).toHaveTextContent('Air quality: Why is this component important to you?');
        expect(blocks[0]).toHaveTextContent('Water quality: Why is this component important to you?');
        // The follow-ups are nested under the checkbox chart, not standalone.
        expect(screen.queryByTestId('comments')).not.toBeInTheDocument();
    });

    it('names a single checkbox option rather than repeating that it was ticked', () => {
        const checkbox: TypedSurveyData = {
            label: 'Which components matter to you?',
            position: 0,
            key: 'simplecheckboxes1',
            type: 'simplecheckboxes',
            result: [{ value: 'Air quality', count: 9 }],
        };
        setupHooks(
            {
                data: { data: [checkbox] },
                conditionalLinks: {
                    followup1: {
                        trigger_key: 'simplecheckboxes1',
                        row_key: 'airQuality',
                        row_label: 'Air quality',
                        trigger_values: ['true'],
                        trigger_value_labels: ['Selected'],
                    },
                },
            },
            {
                data: {
                    data: [
                        {
                            label: 'Tell us why',
                            position: 1,
                            key: 'followup1',
                            type: 'simpletextarea',
                            result: [{ value: 'a comment', count: 1 }],
                        } as TypedSurveyData,
                    ],
                },
            },
        );

        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        expect(screen.getByTestId('conditional-follow-up')).toHaveTextContent(
            'Conditional — shown to respondents who selected "Air quality"',
        );
    });

    it('describes a multi-select dropdown option like a ticked box, not as an answer given', () => {
        const dropdown: TypedSurveyData = {
            label: 'Which components matter to you?',
            position: 0,
            key: 'simpleselect1',
            type: 'simpleselect',
            result: [
                { value: 'Air quality', count: 9 },
                { value: 'Water quality', count: 6 },
            ],
        };
        // A picked option out of a multi-select carries the same 'true' a ticked checkbox does.
        const link = (rowKey: string, rowLabel: string) => ({
            trigger_key: 'simpleselect1',
            trigger_label: 'Which components matter to you?',
            row_key: rowKey,
            row_label: rowLabel,
            trigger_values: ['true'],
            trigger_value_labels: ['Selected'],
        });
        const followUp = (key: string, label: string): TypedSurveyData => ({
            label,
            position: 1,
            key,
            type: 'simpletextarea',
            result: [{ value: 'a comment', count: 1 }],
        });
        setupHooks(
            {
                data: { data: [dropdown] },
                conditionalLinks: {
                    followupAir: link('airQuality', 'Air quality'),
                    followupWater: link('waterQuality', 'Water quality'),
                },
            },
            {
                data: {
                    data: [
                        followUp('followupAir', 'Why is air quality important to you?'),
                        followUp('followupWater', 'Why is water quality important to you?'),
                    ],
                },
            },
        );

        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        const blocks = screen.getAllByTestId('conditional-follow-up');
        expect(blocks).toHaveLength(1);
        expect(blocks[0]).toHaveTextContent('Conditional — shown to respondents who selected any of these options');
        expect(blocks[0]).toHaveTextContent('comments across all options');
    });

    it('names a follow-up from the form when it has no comment data, never by its key', () => {
        const radio: TypedSurveyData = {
            label: 'Where do you live?',
            position: 0,
            key: 'simpleradios1',
            type: 'simpleradios',
            result: [{ value: 'Other', count: 4 }],
        };
        // No comment question for the follow-up: it draws no approved comments, or is not
        // published in the survey's report settings. Either way the key is not a question.
        setupHooks(
            {
                data: { data: [radio] },
                conditionalLinks: {
                    simpletextfield1: {
                        trigger_key: 'simpleradios1',
                        trigger_label: 'Where do you live?',
                        follow_up_label: 'Please specify where you live',
                        row_key: null,
                        row_label: null,
                        trigger_values: ['other'],
                        trigger_value_labels: ['Other'],
                    },
                },
            },
            { data: { data: [] } },
        );

        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        const block = screen.getByTestId('conditional-follow-up');
        expect(block).toHaveTextContent('Please specify where you live');
        expect(block).not.toHaveTextContent('simpletextfield1');
    });

    it('keeps follow-up comments under a notice when their trigger question has no chart', () => {
        const followUpComment: TypedSurveyData = {
            label: 'Please elaborate',
            position: 1,
            key: 'followup1',
            type: 'simpletextarea',
            result: [{ value: 'more detail', count: 1 }],
        };
        setupHooks(
            {
                data: { data: [] },
                conditionalLinks: {
                    followup1: {
                        trigger_key: 'radioExcludedFromReport',
                        row_key: null,
                        row_label: null,
                        trigger_values: ['other'],
                        trigger_value_labels: ['Other'],
                    },
                },
            },
            { data: { data: [followUpComment] } },
        );

        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        expect(screen.getByText(/is not included in this report/i)).toBeInTheDocument();
        expect(screen.getByTestId('conditional-follow-up')).toHaveTextContent('Please elaborate');
    });

    it('stays silent about a missing trigger question when its follow-up drew no comments', () => {
        setupHooks({
            data: { data: [radioQuestion] },
            conditionalLinks: {
                followup1: {
                    trigger_key: 'radioExcludedFromReport',
                    row_key: null,
                    row_label: null,
                    trigger_values: ['other'],
                    trigger_value_labels: ['Other'],
                },
            },
        });

        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        expect(screen.queryByText(/is not included in this report/i)).not.toBeInTheDocument();
        expect(screen.getByTestId('donut-chart')).toBeInTheDocument();
    });

    it('paginates through wizard pages using the stepper and next/previous controls', () => {
        const page1Question: TypedSurveyData = {
            label: 'Page 1 Q',
            position: 0,
            key: 'q1',
            type: 'simpleradios',
            result: [{ value: 'yes', count: 1 }],
        };
        const page2Question: TypedSurveyData = {
            label: 'Page 2 Q',
            position: 1,
            key: 'q2',
            type: 'simpleradios',
            result: [{ value: 'no', count: 1 }],
        };
        setupHooks({
            data: { data: [page1Question, page2Question] },
            pages: [
                { title: 'Page 1', questions: [page1Question], keys: ['q1'] },
                { title: 'Page 2', questions: [page2Question], keys: ['q2'] },
            ],
        });

        render(<SurveyResultsCharts engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        expect(screen.getByText('Page 1 Q')).toBeInTheDocument();
        expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Next'));

        expect(screen.getByText('Page 2 Q')).toBeInTheDocument();
        expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    });
});

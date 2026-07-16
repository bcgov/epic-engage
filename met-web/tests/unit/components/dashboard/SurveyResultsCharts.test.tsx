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
    DonutChart: () => <div data-testid="donut-chart" />,
    LikertChart: () => <div data-testid="likert-chart" />,
    RankOrderChart: () => <div data-testid="rank-order-chart" />,
    CheckboxChart: ({ question }: { question: string }) => <div data-testid="checkbox-chart">{question}</div>,
    Comments: ({ question, responses }: { question: string; responses: string[] }) => (
        <div data-testid="comments">
            {question}: {responses.join(', ')}
        </div>
    ),
    ConditionalFollowUp: ({ conditionLabel, question }: { conditionLabel: string; question: string }) => (
        <div data-testid="conditional-follow-up">
            {conditionLabel} | {question}
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

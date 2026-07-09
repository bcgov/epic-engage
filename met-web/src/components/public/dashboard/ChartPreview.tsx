import { useState } from 'react';
import { Box, Divider, Skeleton } from '@mui/material';
import { MetPaper, MetHeader4, MetDescription } from 'components/shared/common';
import { DonutChart, LikertChart, RankOrderChart, Comments, CheckboxChart } from './charts';
import { QuestionTypeLabel } from './charts/QuestionTypeLabel';
import { TypedSurveyData, FlatResultItem, MatrixResultRow } from 'models/analytics/surveyResult';
import { Engagement } from 'models/engagement';
import { ErrorBox } from 'components/shared/analytics/ErrorBox';
import { NoData } from 'components/shared/analytics/NoData';
import FormStepper from 'components/public/survey/submit/Stepper';
import { useSurveyResultPages } from './hooks/useSurveyResultPages';

const COMPONENT_TYPE = {
    RADIO: 'simpleradios',
    CHECKBOX: 'simplecheckboxes',
    SELECT: 'simpleselect',
    SURVEY: 'simplesurvey',
    TEXTAREA: 'simpletextarea',
    TEXTFIELD: 'simpletextfield',
    RANKING: 'simpleranking',
} as const;

const TYPE_LABELS: Record<string, string> = {
    simpleradios: 'Radio Button',
    simplecheckboxes: 'Checkbox',
    simpleselect: 'Drop-down',
    simplesurvey: 'Likert Matrix',
    simpletextarea: 'Multiple Lines Answer',
    simpletextfield: 'Single Line Answer',
    simpleranking: 'Rank Order',
};

const isMatrixRow = (r: FlatResultItem | MatrixResultRow): r is MatrixResultRow => 'pcts' in r;

function toFlatItems(result: (FlatResultItem | MatrixResultRow)[]): FlatResultItem[] {
    return result.filter((r): r is FlatResultItem => !isMatrixRow(r));
}

function toMatrixRows(result: (FlatResultItem | MatrixResultRow)[]): MatrixResultRow[] {
    return result.filter(isMatrixRow);
}

function flatToChartItems(items: FlatResultItem[]) {
    const total = items.reduce((sum, r) => sum + r.count, 0);
    return {
        total,
        data: items.map((r) => ({
            label: r.value,
            pct: total > 0 ? Math.round((r.count / total) * 100) : 0,
            count: r.count,
        })),
    };
}

interface QuestionChartProps {
    question: TypedSurveyData;
}

const QuestionChart = ({ question }: QuestionChartProps) => {
    const { label, type, result } = question;

    switch (type) {
        case COMPONENT_TYPE.RADIO:
        case COMPONENT_TYPE.SELECT: {
            const { data, total } = flatToChartItems(toFlatItems(result));
            return (
                <MetPaper sx={{ p: 3, border: '1px solid #d8d8d8' }}>
                    <QuestionTypeLabel label={TYPE_LABELS[type]} />
                    <MetHeader4 sx={{ lineHeight: 1.4 }}>{label}</MetHeader4>
                    <MetDescription sx={{ mb: '18px' }}>{total.toLocaleString()} respondents</MetDescription>
                    <DonutChart data={data} total={total} />
                </MetPaper>
            );
        }

        case COMPONENT_TYPE.CHECKBOX: {
            const { data, total } = flatToChartItems(toFlatItems(result));
            return (
                <CheckboxChart
                    question={label}
                    respondentCount={total}
                    data={data}
                    questionType={TYPE_LABELS[type]}
                />
            );
        }

        case COMPONENT_TYPE.SURVEY: {
            const rows = toMatrixRows(result);
            return (
                <MetPaper sx={{ p: 3, border: '1px solid #d8d8d8' }}>
                    <QuestionTypeLabel label={TYPE_LABELS[type]} />
                    <MetHeader4 sx={{ lineHeight: 1.4 }}>{label}</MetHeader4>
                    <LikertChart data={rows} axisLabels={['Not Effective', 'Effective']} />
                </MetPaper>
            );
        }

        case COMPONENT_TYPE.RANKING: {
            const rows = toMatrixRows(result);
            return (
                <MetPaper sx={{ p: 3, border: '1px solid #d8d8d8' }}>
                    <QuestionTypeLabel label={TYPE_LABELS[type]} />
                    <MetHeader4 sx={{ lineHeight: 1.4 }}>{label}</MetHeader4>
                    <MetDescription sx={{ mb: '18px' }}>1 = most important</MetDescription>
                    <RankOrderChart data={rows.map((r) => ({ label: r.label, ranks: r.pcts }))} />
                </MetPaper>
            );
        }

        case COMPONENT_TYPE.TEXTAREA:
        case COMPONENT_TYPE.TEXTFIELD: {
            const responses = toFlatItems(result).map((r) => r.value);
            return (
                <Comments
                    question={label}
                    subText="Submitted responses"
                    responses={responses}
                    questionType={TYPE_LABELS[type]}
                />
            );
        }

        default:
            return null;
    }
};

interface ChartPreviewProps {
    engagement: Engagement;
    engagementIsLoading: boolean;
    dashboardType: string;
}

export const ChartPreview = ({ engagement, engagementIsLoading, dashboardType }: ChartPreviewProps) => {
    const [currentPage, setCurrentPage] = useState(0);
    const surveyId = engagement.surveys?.[0]?.id;
    const { data, pages, isLoading, isError, refetch } = useSurveyResultPages(
        Number(engagement.id),
        surveyId ? Number(surveyId) : undefined,
        dashboardType,
    );

    if (isLoading || engagementIsLoading) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 4 }}>
                <Skeleton variant="rectangular" height={300} />
                <Skeleton variant="rectangular" height={300} />
            </Box>
        );
    }

    if (isError) {
        return <ErrorBox sx={{ mt: 4 }} onClick={refetch} />;
    }

    if (!data?.data?.length) {
        return <NoData sx={{ mt: 4 }} />;
    }
    const safePage = pages ? Math.min(currentPage, pages.length - 1) : 0;
    const questionsToShow = pages ? pages[safePage].questions : data.data;
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 4 }}>
            <Divider sx={{ mb: 1 }}>
                <MetDescription sx={{ color: '#9F9D9C', fontSize: 12 }}>Survey Results</MetDescription>
            </Divider>
            {pages && pages.length > 1 && (
                <FormStepper currentPage={safePage} pages={pages} onStepClick={(index) => setCurrentPage(index)} />
            )}
            {questionsToShow.length ? (
                questionsToShow.map((question) => <QuestionChart key={question.key} question={question} />)
            ) : (
                <NoData />
            )}
        </Box>
    );
};

export default ChartPreview;

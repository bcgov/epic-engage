import { useEffect, useState } from 'react';
import { Box, Divider, Skeleton } from '@mui/material';
import { MetPaper, MetHeader4, MetDescription } from 'components/shared/common';
import {
    DonutChart,
    LikertChart,
    RankOrderChart,
    Comments,
    HorizontalBarList,
    ConditionalBlock,
    QuestionTypeLabel,
} from './charts';
import { getSurveyResultData } from 'services/analytics/surveyResult';
import { getSurveyForDashboard } from 'services/surveyService';
import { TypedSurveyData, TypedSurveyResultData, FlatResultItem, MatrixResultRow } from 'models/analytics/surveyResult';
import { Engagement } from 'models/engagement';
import { ErrorBox } from 'components/shared/analytics/ErrorBox';
import { NoData } from 'components/shared/analytics/NoData';
import FormStepper from 'components/public/survey/submit/Stepper';
import { buildQuestionGroups, buildResultPages, QuestionGroup, ResultPage, DashboardSurveyForm } from './surveyPages';
import axios from 'axios';

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

const DEFAULT_SCALE_LABELS = ['Not effective', 'Neutral', 'Somewhat effective', 'Effective', 'Very effective'];

const isMatrixRow = (r: FlatResultItem | MatrixResultRow): r is MatrixResultRow => 'pcts' in r;

function toFlatItems(result: (FlatResultItem | MatrixResultRow)[]): FlatResultItem[] {
    return result.filter((r): r is FlatResultItem => !isMatrixRow(r));
}

function toMatrixRows(result: (FlatResultItem | MatrixResultRow)[]): MatrixResultRow[] {
    return result.filter(isMatrixRow);
}

/**
 * Percentages are of respondents, not of answers: a checkbox question has more answers than
 * respondents. Falls back to the total number of answers for results gathered before the
 * analytics API started reporting a respondent count.
 */
function flatToChartItems(question: TypedSurveyData) {
    const items = toFlatItems(question.result);
    const answers = items.reduce((sum, r) => sum + r.count, 0);
    const total = question.respondents || answers;
    return {
        total,
        data: items.map((r) => ({
            label: r.value,
            pct: total > 0 ? Math.round((r.count / total) * 100) : 0,
            count: r.count,
        })),
    };
}

function matrixRespondents(question: TypedSurveyData, rows: MatrixResultRow[]) {
    return question.respondents || Math.max(...rows.map((r) => r.n), 0);
}

const respondentText = (count: number) => `${count.toLocaleString()} respondents`;

interface QuestionCardContent {
    // Count shown under the question title; the donut carries its own count in the middle.
    subText?: string;
    body: JSX.Element | null;
}

/**
 * The chart for a single question, without the card around it, so a question can be
 * rendered either on its own or inside the card of the question it is conditional on.
 */
const questionContent = (question: TypedSurveyData): QuestionCardContent => {
    const { type, result } = question;

    switch (type) {
        case COMPONENT_TYPE.RADIO:
        case COMPONENT_TYPE.SELECT: {
            const { data, total } = flatToChartItems(question);
            return { body: <DonutChart data={data} total={total} /> };
        }

        case COMPONENT_TYPE.CHECKBOX: {
            const { data, total } = flatToChartItems(question);
            return { subText: respondentText(total), body: <HorizontalBarList data={data} /> };
        }

        case COMPONENT_TYPE.SURVEY: {
            const rows = toMatrixRows(result);
            return {
                subText: respondentText(matrixRespondents(question, rows)),
                body: (
                    <LikertChart
                        data={rows}
                        scaleLabels={question.scale?.length ? question.scale : DEFAULT_SCALE_LABELS}
                    />
                ),
            };
        }

        case COMPONENT_TYPE.RANKING: {
            const rows = toMatrixRows(result);
            return {
                subText: respondentText(matrixRespondents(question, rows)),
                body: <RankOrderChart data={rows.map((r) => ({ label: r.label, ranks: r.pcts }))} />,
            };
        }

        case COMPONENT_TYPE.TEXTAREA:
        case COMPONENT_TYPE.TEXTFIELD: {
            const responses = toFlatItems(result).map((r) => r.value);
            return {
                subText: `${responses.length.toLocaleString()} comments`,
                body: <Comments subText="Submitted responses" responses={responses} />,
            };
        }

        default:
            return { body: null };
    }
};

interface QuestionChartProps {
    group: QuestionGroup;
}

const QuestionChart = ({ group }: QuestionChartProps) => {
    const { question, conditionals } = group;
    const { subText, body } = questionContent(question);

    if (!body) {
        return null;
    }

    return (
        <MetPaper sx={{ p: 3, border: '1px solid #d8d8d8' }}>
            <QuestionTypeLabel label={TYPE_LABELS[question.type]} />
            <MetHeader4 sx={{ lineHeight: 1.4 }}>{question.label}</MetHeader4>
            {subText && <MetDescription sx={{ mb: '18px' }}>{subText}</MetDescription>}
            {body}
            {conditionals.map(({ question: conditionalQuestion, eq }) => {
                const conditionalContent = questionContent(conditionalQuestion);
                return conditionalContent.body ? (
                    <ConditionalBlock key={conditionalQuestion.key} question={conditionalQuestion.label} eq={eq}>
                        {conditionalContent.subText && (
                            <MetDescription sx={{ mb: '12px' }}>{conditionalContent.subText}</MetDescription>
                        )}
                        {conditionalContent.body}
                    </ConditionalBlock>
                ) : null;
            })}
        </MetPaper>
    );
};

interface ChartPreviewProps {
    engagement: Engagement;
    engagementIsLoading: boolean;
    dashboardType: string;
}

export const ChartPreview = ({ engagement, engagementIsLoading, dashboardType }: ChartPreviewProps) => {
    const [data, setData] = useState<TypedSurveyResultData | null>(null);
    const [form, setForm] = useState<DashboardSurveyForm | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        setIsError(false);
        try {
            const surveyId = engagement.surveys?.[0]?.id;
            const [response, survey] = await Promise.all([
                getSurveyResultData(Number(engagement.id), dashboardType),
                surveyId ? getSurveyForDashboard(Number(surveyId)).catch(() => undefined) : Promise.resolve(undefined),
            ]);
            setData(response as unknown as TypedSurveyResultData);
            setForm(survey);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                setData(null);
            } else {
                setIsError(true);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (Number(engagement.id)) {
            fetchData();
        }
    }, [engagement.id]);

    if (isLoading || engagementIsLoading) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 4 }}>
                <Skeleton variant="rectangular" height={300} />
                <Skeleton variant="rectangular" height={300} />
            </Box>
        );
    }

    if (isError) {
        return <ErrorBox sx={{ mt: 4 }} onClick={fetchData} />;
    }

    if (!data?.data?.length) {
        return <NoData sx={{ mt: 4 }} />;
    }
    const pages: ResultPage[] | null = buildResultPages(form, data.data);
    const safePage = pages ? Math.min(currentPage, pages.length - 1) : 0;
    const groupsToShow = pages ? pages[safePage].questions : buildQuestionGroups(data.data, form?.conditionals);
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 4 }}>
            <Divider sx={{ mb: 1 }}>
                <MetDescription sx={{ color: '#9F9D9C', fontSize: 12 }}>Survey Results</MetDescription>
            </Divider>
            {pages && pages.length > 1 && (
                <FormStepper currentPage={safePage} pages={pages} onStepClick={(index) => setCurrentPage(index)} />
            )}
            {groupsToShow.length ? (
                groupsToShow.map((group) => <QuestionChart key={group.question.key} group={group} />)
            ) : (
                <NoData />
            )}
        </Box>
    );
};

export default ChartPreview;

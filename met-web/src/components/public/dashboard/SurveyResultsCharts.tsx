import { useState } from 'react';
import { Box, Skeleton, Stack } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import {
    MetPaper,
    MetHeader4,
    MetDescription,
    MetHeader3,
    PrimaryButton,
    SecondaryButton,
} from 'components/shared/common';
import { DonutChart, LikertChart, RankOrderChart, Comments, CheckboxChart, ConditionalFollowUp } from './charts';
import { QuestionTypeLabel } from './charts/QuestionTypeLabel';
import { TypedSurveyData, FlatResultItem, MatrixResultRow } from 'models/analytics/surveyResult';
import { Engagement } from 'models/engagement';
import { ErrorBox } from 'components/shared/analytics/ErrorBox';
import { NoData } from 'components/shared/analytics/NoData';
import FormStepper from 'components/public/survey/submit/Stepper';
import { useSurveyResultPages } from './hooks/useSurveyResultPages';
import { useSurveyComments } from './hooks/useSurveyComments';
import { ConditionalLink } from './surveyPages';
import { DashboardType } from 'constants/dashboardType';

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

// A matrix question (simplesurvey/simpleranking) whose analytics rows were synced by an
// older met-etl version, before it started writing the parent row matrix results roll up
// under. Its sub-question rows still exist, just as orphaned flat entries the frontend can't
// render as a chart, so it's shown as a compatibility warning instead of a broken/empty chart.
interface StaleFormatNotice {
    staleKey: string;
}

const isStaleMatrixEntry = (q: TypedSurveyData) =>
    (q.type === COMPONENT_TYPE.SURVEY || q.type === COMPONENT_TYPE.RANKING) &&
    q.key.includes('-') &&
    toMatrixRows(q.result).length === 0;

interface ResolvedFollowUp {
    key: string;
    link: ConditionalLink;
    // The follow-up question's own label, used as the comments drawer title.
    question: string;
    responses: string[];
}

const ORDINAL_SUFFIXES: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };

// Ranking trigger values are rank positions ('1', '2', ...) rather than option codes, so they
// read better as ordinals ("1st or 2nd") than as the raw numbers the backend can't otherwise label.
const formatOrdinal = (value: string): string => {
    const n = Number(value);
    if (!Number.isInteger(n)) {
        return value;
    }
    const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ORDINAL_SUFFIXES[n % 10] ?? 'th';
    return `${n}${suffix}`;
};

const describeConditional = (link: ConditionalLink, triggerType?: string): string => {
    const values =
        triggerType === COMPONENT_TYPE.RANKING ? link.trigger_values.map(formatOrdinal) : link.trigger_value_labels;
    const valuesPhrase = values.join('" or "');

    if (!link.row_label) {
        return `Conditional — shown to respondents who selected "${valuesPhrase}"`;
    }
    if (triggerType === COMPONENT_TYPE.RANKING) {
        return `Conditional — shown to respondents who ranked "${link.row_label}" ${valuesPhrase}`;
    }
    return `Conditional — shown to respondents who answered "${valuesPhrase}" for "${link.row_label}"`;
};

const StaleFormatCard = ({ questionKey }: { questionKey: string }) => (
    <MetPaper sx={{ p: 3, border: '1px solid #d8d8d8' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningAmberIcon fontSize="small" sx={{ color: '#B54708' }} />
            <MetDescription sx={{ color: '#474543' }}>
                Survey data for &quot;{questionKey}&quot; has not been updated to a format compatible with this chart.
            </MetDescription>
        </Box>
    </MetPaper>
);

interface QuestionChartProps {
    question: TypedSurveyData;
    commentsByKey: Map<string, string[]>;
    followUps: ResolvedFollowUp[];
    dashboardType: string;
}

const renderFollowUps = (followUps: ResolvedFollowUp[], type: string) =>
    followUps.map((followUp) => (
        <ConditionalFollowUp
            key={followUp.key}
            conditionLabel={describeConditional(followUp.link, type)}
            question={followUp.question}
            responses={followUp.responses}
        />
    ));

const QuestionChart = ({ question, commentsByKey, followUps, dashboardType }: QuestionChartProps) => {
    const { label, type, result } = question;
    const questionType = dashboardType === DashboardType.INTERNAL ? TYPE_LABELS[type] : undefined;

    switch (type) {
        case COMPONENT_TYPE.RADIO:
        case COMPONENT_TYPE.SELECT: {
            const { data, total } = flatToChartItems(toFlatItems(result));
            return (
                <MetPaper sx={{ p: 3, border: '1px solid #d8d8d8' }}>
                    {questionType && <QuestionTypeLabel label={questionType} />}
                    <MetHeader4 sx={{ lineHeight: 1.4 }}>{label}</MetHeader4>
                    <MetDescription sx={{ mb: '18px' }}>{total.toLocaleString()} respondents</MetDescription>
                    <DonutChart data={data} total={total} />
                    {renderFollowUps(followUps, type)}
                </MetPaper>
            );
        }

        case COMPONENT_TYPE.CHECKBOX: {
            const { data, total } = flatToChartItems(toFlatItems(result));
            return (
                <CheckboxChart question={label} respondentCount={total} data={data} questionType={questionType} />
            );
        }

        case COMPONENT_TYPE.SURVEY: {
            const rows = toMatrixRows(result);
            return (
                <MetPaper sx={{ p: 3, border: '1px solid #d8d8d8' }}>
                    {questionType && <QuestionTypeLabel label={questionType} />}
                    <MetHeader4 sx={{ lineHeight: 1.4 }}>{label}</MetHeader4>
                    <LikertChart data={rows} axisLabels={['Not Effective', 'Effective']} />
                    {renderFollowUps(followUps, type)}
                </MetPaper>
            );
        }

        case COMPONENT_TYPE.RANKING: {
            const rows = toMatrixRows(result);
            return (
                <MetPaper sx={{ p: 3, border: '1px solid #d8d8d8' }}>
                    {questionType && <QuestionTypeLabel label={questionType} />}
                    <MetHeader4 sx={{ lineHeight: 1.4 }}>{label}</MetHeader4>
                    <MetDescription sx={{ mb: '18px' }}>1 = most important</MetDescription>
                    <RankOrderChart data={rows.map((r) => ({ label: r.label, ranks: r.pcts }))} />
                    {renderFollowUps(followUps, type)}
                </MetPaper>
            );
        }

        case COMPONENT_TYPE.TEXTAREA:
        case COMPONENT_TYPE.TEXTFIELD: {
            const responses = commentsByKey.get(question.key) ?? toFlatItems(result).map((r) => r.value);
            return <Comments question={label} responses={responses} questionType={questionType} />;
        }

        default:
            return null;
    }
};

interface SurveyResultsChartsProps {
    engagement: Engagement;
    engagementIsLoading: boolean;
    dashboardType: string;
}

export const SurveyResultsCharts = ({ engagement, engagementIsLoading, dashboardType }: SurveyResultsChartsProps) => {
    const [currentPage, setCurrentPage] = useState(0);
    const surveyId = engagement.surveys?.[0]?.id;
    const { data, pages, conditionalLinks, isLoading, isError, refetch } = useSurveyResultPages(
        Number(engagement.id),
        surveyId ? Number(surveyId) : undefined,
        dashboardType,
    );
    const {
        data: commentsData,
        isLoading: commentsIsLoading,
        isError: commentsIsError,
        refetch: refetchComments,
    } = useSurveyComments(Number(engagement.id), surveyId ? Number(surveyId) : undefined, dashboardType);

    // Free-text (simpletextarea/simpletextfield) questions are never synced to the analytics
    // dataset.Comments are instead sourced live from met-api, so they need to be merged into the
    // per-page question list here.
    const commentQuestionsByKey = new Map<string, TypedSurveyData>(
        (commentsData?.data ?? []).map((question) => [question.key, question]),
    );
    const commentsByKey = new Map<string, string[]>(
        (commentsData?.data ?? []).map((question) => [question.key, toFlatItems(question.result).map((r) => r.value)]),
    );

    // Conditionally-shown free-text follow-ups are grouped under their trigger question's chart.
    const followUpsByTrigger = new Map<string, ResolvedFollowUp[]>();
    Object.entries(conditionalLinks).forEach(([followUpKey, link]) => {
        const resolved: ResolvedFollowUp = {
            key: followUpKey,
            link,
            question: commentQuestionsByKey.get(followUpKey)?.label ?? followUpKey,
            responses: commentsByKey.get(followUpKey) ?? [],
        };
        followUpsByTrigger.set(link.trigger_key, [...(followUpsByTrigger.get(link.trigger_key) ?? []), resolved]);
    });

    if (isLoading || commentsIsLoading || engagementIsLoading) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 4 }}>
                <Skeleton variant="rectangular" height={300} />
                <Skeleton variant="rectangular" height={300} />
            </Box>
        );
    }

    if (isError || commentsIsError) {
        return (
            <ErrorBox
                sx={{ mt: 4 }}
                onClick={() => {
                    refetch();
                    refetchComments();
                }}
            />
        );
    }

    if (!data?.data?.length && !commentsData?.data?.length) {
        return <NoData sx={{ mt: 4 }} />;
    }
    const safePage = pages ? Math.min(currentPage, pages.length - 1) : 0;
    // Rebuild the page's question order from its true form field order (page.keys) so
    // chart questions and comment questions interleave correctly - the two datasets are
    // fetched separately and each only cover a disjoint subset of the page's questions.
    let questionsToShow: (TypedSurveyData | StaleFormatNotice)[];
    if (pages) {
        const chartPage = pages[safePage];
        const chartQuestionsByKey = new Map(chartPage.questions.map((q) => [q.key, q]));
        questionsToShow = chartPage.keys
            .map((key): TypedSurveyData | StaleFormatNotice | undefined => {
                // Rendered nested under its trigger question's chart instead of standalone.
                if (conditionalLinks[key]) {
                    return undefined;
                }
                const chartQuestion = chartQuestionsByKey.get(key);
                if (chartQuestion) {
                    return chartQuestion;
                }
                const commentQuestion = commentQuestionsByKey.get(key);
                if (commentQuestion) {
                    return commentQuestion;
                }
                const hasStaleMatrixData = (data?.data ?? []).some(
                    (q) => q.key.startsWith(`${key}-`) && isStaleMatrixEntry(q),
                );
                return hasStaleMatrixData ? { staleKey: key } : undefined;
            })
            .filter((q): q is TypedSurveyData | StaleFormatNotice => Boolean(q));
    } else {
        const seenStaleBaseKeys = new Set<string>();
        questionsToShow = [...(data?.data ?? []), ...(commentsData?.data ?? [])].reduce<
            (TypedSurveyData | StaleFormatNotice)[]
        >((items, q) => {
            // Rendered nested under its trigger question's chart instead of standalone.
            if (conditionalLinks[q.key]) {
                return items;
            }
            if (isStaleMatrixEntry(q)) {
                const baseKey = q.key.split('-')[0];
                if (!seenStaleBaseKeys.has(baseKey)) {
                    seenStaleBaseKeys.add(baseKey);
                    items.push({ staleKey: baseKey });
                }
                return items;
            }
            items.push(q);
            return items;
        }, []);
    }
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 4 }}>
            {pages && pages.length > 1 && (
                <FormStepper currentPage={safePage} pages={pages} onStepClick={(index) => setCurrentPage(index)} />
            )}
            {pages && pages[safePage].title && (
                <MetHeader3 sx={{ color: '#013366' }}>{pages[safePage].title}</MetHeader3>
            )}
            {questionsToShow.length ? (
                questionsToShow.map((question) =>
                    'staleKey' in question ? (
                        <StaleFormatCard key={question.staleKey} questionKey={question.staleKey} />
                    ) : (
                        <QuestionChart
                            key={question.key}
                            question={question}
                            commentsByKey={commentsByKey}
                            followUps={followUpsByTrigger.get(question.key) ?? []}
                            dashboardType={dashboardType}
                        />
                    ),
                )
            ) : (
                <NoData />
            )}
            {pages && pages.length > 1 && (
                <Box sx={{ pt: 1 }}>
                    <MetDescription sx={{ pt: 1.5, mb: 1.5, width: 'fit-content', borderTop: '1px solid #D8D8D8' }}>
                        Page {safePage + 1} of {pages.length}
                    </MetDescription>
                    <Stack direction="row" justifyContent="space-between" sx={{ width: '100%' }}>
                        <SecondaryButton
                            startIcon={<ArrowBackIcon />}
                            disabled={safePage === 0}
                            onClick={() => setCurrentPage(safePage - 1)}
                        >
                            Previous
                        </SecondaryButton>
                        <PrimaryButton
                            endIcon={<ArrowForwardIcon />}
                            disabled={safePage === pages.length - 1}
                            onClick={() => setCurrentPage(safePage + 1)}
                        >
                            Next
                        </PrimaryButton>
                    </Stack>
                </Box>
            )}
        </Box>
    );
};

export default SurveyResultsCharts;

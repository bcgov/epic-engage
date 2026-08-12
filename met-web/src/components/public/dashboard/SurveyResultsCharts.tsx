import { ReactNode, useState } from 'react';
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
import { ConditionalLink, conditionKey, isMembershipTrigger } from './surveyPages';
import { DashboardType } from 'constants/dashboardType';
import { Palette } from 'styles/Theme';

export const COMPONENT_TYPE = {
    RADIO: 'simpleradios',
    CHECKBOX: 'simplecheckboxes',
    SELECT: 'simpleselect',
    SURVEY: 'simplesurvey',
    TEXTAREA: 'simpletextarea',
    TEXTFIELD: 'simpletextfield',
    RANKING: 'simpleranking',
} as const;

export const TYPE_LABELS: Record<string, string> = {
    simpleradios: 'Radio Button',
    simplecheckboxes: 'Checkbox',
    simpleselect: 'Drop-down',
    simplesurvey: 'Likert Matrix',
    simpletextarea: 'Multiple Lines Answer',
    simpletextfield: 'Single Line Answer',
    simpleranking: 'Rank Order',
};

const isMatrixRow = (r: FlatResultItem | MatrixResultRow): r is MatrixResultRow => 'pcts' in r;

export function toFlatItems(result: (FlatResultItem | MatrixResultRow)[]): FlatResultItem[] {
    return result.filter((r): r is FlatResultItem => !isMatrixRow(r));
}

export function toMatrixRows(result: (FlatResultItem | MatrixResultRow)[]): MatrixResultRow[] {
    return result.filter(isMatrixRow);
}

export function flatToChartItems(items: FlatResultItem[], pctBase?: number) {
    const total = items.reduce((sum, r) => sum + r.count, 0);
    const base = pctBase && pctBase > 0 ? pctBase : total;
    return {
        total,
        data: items.map((r) => ({
            label: r.value,
            pct: base > 0 ? Math.round((r.count / base) * 100) : 0,
            count: r.count,
        })),
    };
}

const TitleGap = () => <Box sx={{ mb: '18px' }} />;

const RespondentCount = ({ count, suffix }: { count?: number; suffix?: string }) => {
    if (!count) {
        return suffix ? <MetDescription sx={{ mb: '18px' }}>{suffix}</MetDescription> : <TitleGap />;
    }
    return (
        <MetDescription sx={{ mb: '18px' }}>
            {count.toLocaleString()} respondents
            {suffix ? ` · ${suffix}` : ''}
        </MetDescription>
    );
};

// A matrix question (simplesurvey/simpleranking) whose analytics rows were synced by an
// older met-etl version, before it started writing the parent row matrix results roll up
// under. Its sub-question rows still exist, just as orphaned flat entries the frontend can't
// render as a chart, so it's shown as a compatibility warning instead of a broken/empty chart.
interface StaleFormatNotice {
    staleKey: string;
}

// A trigger question that has follow-up comments but no chart of its own - it's excluded from
// the report, or the ETL never synced it. Without this the follow-ups would be dropped from the
// standalone list as conditionals and then have no chart to nest under, silently losing them.
interface OrphanTriggerNotice {
    orphanTriggerKey: string;
}

type PageItem = TypedSurveyData | StaleFormatNotice | OrphanTriggerNotice;

const isStaleMatrixEntry = (q: TypedSurveyData) =>
    (q.type === COMPONENT_TYPE.SURVEY || q.type === COMPONENT_TYPE.RANKING) &&
    q.key.includes('-') &&
    toMatrixRows(q.result).length === 0;

export interface ResolvedFollowUp {
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

// `anyRow` states the answer without naming any single row, for a block that merges several
// row-specific follow-ups sharing one condition (see groupFollowUps).
export const describeConditional = (link: ConditionalLink, triggerType?: string, anyRow = false): string => {
    const isRanking = triggerType === COMPONENT_TYPE.RANKING;
    const valuesPhrase = isRanking
        ? link.trigger_values.map(formatOrdinal).join(' or ')
        : link.trigger_value_labels.map((label) => `"${label}"`).join(' or ');

    if (isMembershipTrigger(link)) {
        return anyRow
            ? 'Conditional — shown to respondents who selected any of these options'
            : `Conditional — shown to respondents who selected "${link.row_label}"`;
    }
    if (anyRow) {
        return isRanking
            ? `Conditional — shown to respondents who ranked a statement ${valuesPhrase}`
            : `Conditional — shown to respondents who answered ${valuesPhrase} for any row`;
    }
    if (!link.row_label) {
        return `Conditional — shown to respondents who selected ${valuesPhrase}`;
    }
    if (isRanking) {
        return `Conditional — shown to respondents who ranked "${link.row_label}" ${valuesPhrase}`;
    }
    return `Conditional — shown to respondents who answered ${valuesPhrase} for "${link.row_label}"`;
};

const NoticeCard = ({ message, children }: { message: string; children?: ReactNode }) => (
    <MetPaper sx={{ p: 3, border: `1px solid ${Palette.border.default}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningAmberIcon fontSize="small" sx={{ color: Palette.icons.warning }} />
            <MetDescription sx={{ color: Palette.text.secondary }}>{message}</MetDescription>
        </Box>
        {children}
    </MetPaper>
);

export interface QuestionChartProps {
    question: TypedSurveyData;
    commentsByKey: Map<string, string[]>;
    followUps: ResolvedFollowUp[];
    dashboardType: string;
    // Renders just the chart content, without the surrounding MetPaper card/title, for callers
    // that render their own. Follow-ups still render read-only regardless of this flag; pass
    // followUps={[]} and render your own nested UI if they need to be editable.
    bare?: boolean;
}

// A matrix commonly has one "tell us why" follow-up per row, all shown on the same answer; the
// wireframe collapses those into a single block rather than repeating a near-identical one per
// row. Only row-specific follow-ups merge - two on the same radio option would be
// indistinguishable once merged.
const groupFollowUps = (followUps: ResolvedFollowUp[]): ResolvedFollowUp[][] => {
    const groups: ResolvedFollowUp[][] = [];
    const groupsByCondition = new Map<string, ResolvedFollowUp[]>();
    followUps.forEach((followUp) => {
        if (!followUp.link.row_label) {
            groups.push([followUp]);
            return;
        }
        const existing = groupsByCondition.get(conditionKey(followUp.link));
        if (existing) {
            existing.push(followUp);
            return;
        }
        const group = [followUp];
        groupsByCondition.set(conditionKey(followUp.link), group);
        groups.push(group);
    });
    return groups;
};

// What a merged block's follow-ups are each hung off, for the "comments across all ___" count. A
// dropdown only reaches this when it is multi-select, where its rows are picked options.
const ROW_NOUNS: Record<string, string> = {
    [COMPONENT_TYPE.RANKING]: 'statements',
    [COMPONENT_TYPE.CHECKBOX]: 'options',
    [COMPONENT_TYPE.SELECT]: 'options',
};

const renderFollowUps = (followUps: ResolvedFollowUp[], type: string, triggerLabel: string) =>
    groupFollowUps(followUps).map((group) => {
        const [first] = group;
        const isMerged = group.length > 1;
        const rowNoun = ROW_NOUNS[type] ?? 'rows';
        return (
            <ConditionalFollowUp
                key={first.key}
                conditionLabel={describeConditional(first.link, type, isMerged)}
                drawerTitle={isMerged ? triggerLabel : first.question}
                countLabel={isMerged ? `comments across all ${rowNoun}` : 'comments received'}
                sections={group.map((followUp) => ({
                    rowLabel: isMerged ? followUp.link.row_label ?? undefined : undefined,
                    question: followUp.question,
                    responses: followUp.responses,
                }))}
            />
        );
    });

export const QuestionChart = ({
    question,
    commentsByKey,
    followUps,
    dashboardType,
    bare = false,
}: QuestionChartProps) => {
    const { label, type, result, respondent_count: respondentCount, scale_labels: scaleLabels } = question;
    const questionType = dashboardType === DashboardType.INTERNAL ? TYPE_LABELS[type] : undefined;

    switch (type) {
        case COMPONENT_TYPE.RADIO:
        case COMPONENT_TYPE.SELECT: {
            const { data, total } = flatToChartItems(toFlatItems(result));
            const respondents = respondentCount || total;
            const content = (
                <>
                    {/* The donut carries the respondent count in its centre, so it isn't repeated here. */}
                    <TitleGap />
                    <DonutChart data={data} total={respondents} />
                    {renderFollowUps(followUps, type, label)}
                </>
            );
            if (bare) {
                return content;
            }
            return (
                <MetPaper sx={{ p: 3, border: `1px solid ${Palette.border.default}` }}>
                    {questionType && <QuestionTypeLabel label={questionType} />}
                    <MetHeader4 sx={{ lineHeight: 1.4 }}>{label}</MetHeader4>
                    {content}
                </MetPaper>
            );
        }

        case COMPONENT_TYPE.CHECKBOX: {
            const { data } = flatToChartItems(toFlatItems(result), respondentCount);
            return (
                <CheckboxChart
                    question={label}
                    respondentCount={respondentCount}
                    data={data}
                    questionType={questionType}
                    bare={bare}
                >
                    {renderFollowUps(followUps, type, label)}
                </CheckboxChart>
            );
        }

        case COMPONENT_TYPE.SURVEY: {
            const rows = toMatrixRows(result);
            const content = (
                <>
                    <RespondentCount count={respondentCount} />
                    <LikertChart data={rows} scaleLabels={scaleLabels} />
                    {renderFollowUps(followUps, type, label)}
                </>
            );
            if (bare) {
                return content;
            }
            return (
                <MetPaper sx={{ p: 3, border: `1px solid ${Palette.border.default}` }}>
                    {questionType && <QuestionTypeLabel label={questionType} />}
                    <MetHeader4 sx={{ lineHeight: 1.4 }}>{label}</MetHeader4>
                    {content}
                </MetPaper>
            );
        }

        case COMPONENT_TYPE.RANKING: {
            const rows = toMatrixRows(result);
            const content = (
                <>
                    <RespondentCount count={respondentCount} suffix="1 = most important" />
                    <RankOrderChart data={rows.map((r) => ({ label: r.label, ranks: r.pcts }))} />
                    {renderFollowUps(followUps, type, label)}
                </>
            );
            if (bare) {
                return content;
            }
            return (
                <MetPaper sx={{ p: 3, border: `1px solid ${Palette.border.default}` }}>
                    {questionType && <QuestionTypeLabel label={questionType} />}
                    <MetHeader4 sx={{ lineHeight: 1.4 }}>{label}</MetHeader4>
                    {content}
                </MetPaper>
            );
        }

        case COMPONENT_TYPE.TEXTAREA:
        case COMPONENT_TYPE.TEXTFIELD: {
            const responses = commentsByKey.get(question.key) ?? toFlatItems(result).map((r) => r.value);
            return <Comments question={label} responses={responses} questionType={questionType} bare={bare} />;
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
            question: commentQuestionsByKey.get(followUpKey)?.label ?? link.follow_up_label ?? followUpKey,
            responses: commentsByKey.get(followUpKey) ?? [],
        };
        followUpsByTrigger.set(link.trigger_key, [...(followUpsByTrigger.get(link.trigger_key) ?? []), resolved]);
    });

    // Only worth a placeholder when there are comments to rescue - a link whose follow-up drew no
    // comments would just add an unexplained warning card to every page it appears on.
    const hasStrandedFollowUps = (triggerKey: string) =>
        (followUpsByTrigger.get(triggerKey) ?? []).some((followUp) => followUp.responses.length > 0);

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
    let questionsToShow: PageItem[];
    if (pages) {
        const chartPage = pages[safePage];
        const chartQuestionsByKey = new Map(chartPage.questions.map((q) => [q.key, q]));
        questionsToShow = chartPage.keys
            .map((key): PageItem | undefined => {
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
                if (hasStaleMatrixData) {
                    return { staleKey: key };
                }
                return hasStrandedFollowUps(key) ? { orphanTriggerKey: key } : undefined;
            })
            .filter((q): q is PageItem => Boolean(q));
    } else {
        const seenStaleBaseKeys = new Set<string>();
        questionsToShow = [...(data?.data ?? []), ...(commentsData?.data ?? [])].reduce<PageItem[]>((items, q) => {
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
        const renderedKeys = new Set(
            questionsToShow.map((item) => ('key' in item ? item.key : (item as StaleFormatNotice).staleKey)),
        );
        [...followUpsByTrigger.keys()]
            .filter((triggerKey) => !renderedKeys.has(triggerKey) && hasStrandedFollowUps(triggerKey))
            .forEach((triggerKey) => questionsToShow.push({ orphanTriggerKey: triggerKey }));
    }
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 4 }}>
            {pages && pages.length > 1 && (
                <FormStepper currentPage={safePage} pages={pages} onStepClick={(index) => setCurrentPage(index)} />
            )}
            {pages && pages[safePage].title && (
                <MetHeader3 sx={{ color: Palette.primary.main }}>{pages[safePage].title}</MetHeader3>
            )}
            {questionsToShow.length ? (
                questionsToShow.map((item) => {
                    if ('staleKey' in item) {
                        return (
                            <NoticeCard
                                key={item.staleKey}
                                message={`Survey data for "${item.staleKey}" has not been updated to a format compatible with this chart.`}
                            />
                        );
                    }
                    if ('orphanTriggerKey' in item) {
                        return (
                            <NoticeCard
                                key={item.orphanTriggerKey}
                                message="The question these comments were shown for is not included in this report."
                            >
                                {renderFollowUps(
                                    followUpsByTrigger.get(item.orphanTriggerKey) ?? [],
                                    '',
                                    'Conditional comments',
                                )}
                            </NoticeCard>
                        );
                    }
                    return (
                        <QuestionChart
                            key={item.key}
                            question={item}
                            commentsByKey={commentsByKey}
                            followUps={followUpsByTrigger.get(item.key) ?? []}
                            dashboardType={dashboardType}
                        />
                    );
                })
            ) : (
                <NoData />
            )}
            {pages && pages.length > 1 && (
                <Box sx={{ pt: 1 }}>
                    <MetDescription sx={{ pt: 1.5, mb: 1.5, width: 'fit-content', borderTop: `1px solid ${Palette.border.default}` }}>
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

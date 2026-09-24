import { TypedSurveyData } from 'models/analytics/surveyResult';
import { SurveyReportSetting } from 'models/surveyReportSetting';
import { COMPONENT_TYPE, TYPE_LABELS } from './SurveyResultsCharts';

/**
 * The charts staff marked "Show in public report". The export is taken from the internal report,
 * but a chart kept off the public report must never leave in a download, so a question with no
 * setting at all is left out too. Matrix rows are rolled up under their parent's key, which is
 * where their one setting is held.
 */
export const selectPublicCharts = (questions: TypedSurveyData[], settings: SurveyReportSetting[]) => {
    // Free-text questions render as comment lists, not charts, so they're never exported as images.
    const chartTypes: string[] = [
        COMPONENT_TYPE.RADIO,
        COMPONENT_TYPE.SELECT,
        COMPONENT_TYPE.CHECKBOX,
        COMPONENT_TYPE.SURVEY,
        COMPONENT_TYPE.RANKING,
    ];
    const publicKeys = new Set(settings.filter((s) => s.display).map((s) => s.question_key));
    return questions.filter((q) => chartTypes.includes(q.type) && publicKeys.has(q.key));
};

// Letters and digits only, e.g. "Big Delicious Ranch" -> "BigDeliciousRanch", "Drop-down" -> "Dropdown".
export const toFileSlug = (text: string) => text.replace(/[^A-Za-z0-9]/g, '');

// "<Engagement>_<QuestionType>_<n>.png", numbered per question type in survey order.
export const chartFileNames = (engagementName: string, charts: TypedSurveyData[]) => {
    const engagement = toFileSlug(engagementName) || 'Engagement';
    const countByType: Record<string, number> = {};
    return charts.map((chart) => {
        countByType[chart.type] = (countByType[chart.type] ?? 0) + 1;
        return `${engagement}_${toFileSlug(TYPE_LABELS[chart.type])}_${countByType[chart.type]}.png`;
    });
};

export const chartZipName = (engagementName: string, date: string) =>
    `${toFileSlug(engagementName) || 'Engagement'}_SurveyCharts_${date}.zip`;

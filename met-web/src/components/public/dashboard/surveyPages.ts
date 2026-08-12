import { TypedSurveyData } from 'models/analytics/surveyResult';

// Reduced survey structure served by the dashboard endpoint: only page titles and the
// question keys on each page (no question text/options).
export interface DashboardSurveyPage {
    title: string;
    questions: string[]; // question keys
}

// A conditionally-shown free-text question's link back to the question/row that triggers it.
// row_key/row_label are null when the trigger is a plain radio/select question rather than a
// specific Likert row or Ranking statement.
export interface ConditionalLink {
    trigger_key: string;
    // The trigger question's own label
    trigger_label?: string | null;
    // The follow-up's own label from the form.
    follow_up_label?: string | null;
    row_key: string | null;
    row_label: string | null;
    trigger_values: string[];
    trigger_value_labels: string[];
}

/**
 * Identity of the condition that reveals a follow-up: the trigger question plus the answers that
 * show it. Row-specific follow-ups sharing one condition are the same question asked once per row,
 * so both dashboard tabs collapse them into a single block rather than repeating it per row.
 */
export const conditionKey = (link: ConditionalLink) => [link.trigger_key, ...link.trigger_values].join('|');

// Represents that an option was picked, not which answer.
const SELECTED_VALUE = 'true';

/**
 * Whether the link's condition is "this option was picked" - a ticked checkbox option or one
 * option of a multi-select dropdown. The row names the option, and there is no separate answer
 * alongside it, so callers describe such a link by its row rather than by its value.
 */
export const isMembershipTrigger = (link: ConditionalLink) =>
    Boolean(link.row_label) && link.trigger_values.length === 1 && link.trigger_values[0] === SELECTED_VALUE;

export interface DashboardSurveyForm {
    id: number;
    display?: string;
    pages: DashboardSurveyPage[];
    // Keyed by the follow-up question's key.
    conditional_links?: Record<string, ConditionalLink>;
}

export interface ResultPage {
    title: string;
    questions: TypedSurveyData[];
    // The page's question keys in true form field order. Chart data (analytics) and comment
    // data (met-api) are fetched separately and each only cover a subset of question types, so
    // this lets callers that need both interleave them in the order they appear on the form.
    keys: string[];
    // index signature so a ResultPage is also a valid FormInfo (consumed by FormStepper)
    [key: string]: unknown;
}

/**
 * Group typed survey result questions into the survey's wizard pages so the
 * public dashboard can step through results the same way the survey is filled out.
 * Returns null when the form is not a multi-page (wizard) form.
 */
export const buildResultPages = (
    form: DashboardSurveyForm | undefined,
    questions: TypedSurveyData[],
): ResultPage[] | null => {
    const isWizard = form?.display === 'wizard' && (form?.pages?.length ?? 0) > 0;
    if (!isWizard || !form) {
        return null;
    }
    return form.pages.map((page) => {
        const keys = new Set(page.questions);
        return { title: page.title, questions: questions.filter((q) => keys.has(q.key)), keys: page.questions };
    });
};

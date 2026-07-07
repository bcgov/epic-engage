import { TypedSurveyData } from 'models/analytics/surveyResult';

// Reduced survey structure served by the dashboard endpoint: only page titles and the
// question keys on each page (no question text/options).
export interface DashboardSurveyPage {
    title: string;
    questions: string[]; // question keys
}

export interface DashboardSurveyForm {
    id: number;
    display?: string;
    pages: DashboardSurveyPage[];
}

export interface ResultPage {
    title: string;
    questions: TypedSurveyData[];
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
        return { title: page.title, questions: questions.filter((q) => keys.has(q.key)) };
    });
};

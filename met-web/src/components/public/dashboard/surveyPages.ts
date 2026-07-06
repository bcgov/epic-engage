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

    const assigned = new Set<string>();
    const pages: ResultPage[] = form.pages.map((page) => {
        const keys = new Set(page.questions);
        const pageQuestions = questions.filter((q) => keys.has(q.key));
        pageQuestions.forEach((q) => assigned.add(q.key));
        return { title: page.title, questions: pageQuestions };
    });

    // Append any result questions not matched to a page (e.g. legacy data) to the last page.
    const orphans = questions.filter((q) => !assigned.has(q.key));
    if (orphans.length && pages.length) {
        pages[pages.length - 1].questions.push(...orphans);
    }

    return pages;
};

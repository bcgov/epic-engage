import { TypedSurveyData } from 'models/analytics/surveyResult';

// Reduced survey structure served by the dashboard endpoint: only page titles and the
// question keys on each page (no question text/options).
export interface DashboardSurveyPage {
    title: string;
    questions: string[]; // question keys
}

// A question that formio only shows when another question was answered a certain way.
export interface DashboardConditional {
    key: string; // the conditional question
    when: string; // the question it depends on
    eq?: string; // the answer that reveals it
}

export interface DashboardSurveyForm {
    id: number;
    display?: string;
    pages: DashboardSurveyPage[];
    conditionals?: DashboardConditional[];
}

// A question plus the conditional questions that hang off it, so the dashboard can render
// them together in one card (AC: conditional free text sits under the question it depends on).
export interface QuestionGroup {
    question: TypedSurveyData;
    conditionals: { question: TypedSurveyData; eq?: string }[];
}

export interface ResultPage {
    title: string;
    questions: QuestionGroup[];
    // index signature so a ResultPage is also a valid FormInfo (consumed by FormStepper)
    [key: string]: unknown;
}

/**
 * Attach each conditional question to the question it depends on. Questions keep the order
 * the analytics API returns them in, which is the order they appear on the survey.
 * A conditional whose parent is not in the list stays a top level question of its own.
 */
export const buildQuestionGroups = (
    questions: TypedSurveyData[],
    conditionals: DashboardConditional[] = [],
): QuestionGroup[] => {
    const byKey = new Map(questions.map((q) => [q.key, q]));
    const conditionalByKey = new Map(
        conditionals.filter((c) => byKey.has(c.key) && byKey.has(c.when)).map((c) => [c.key, c]),
    );

    const groups: QuestionGroup[] = [];
    const groupByKey = new Map<string, QuestionGroup>();
    questions.forEach((question) => {
        if (conditionalByKey.has(question.key)) {
            return;
        }
        const group: QuestionGroup = { question, conditionals: [] };
        groups.push(group);
        groupByKey.set(question.key, group);
    });

    questions.forEach((question) => {
        const conditional = conditionalByKey.get(question.key);
        const parent = conditional && groupByKey.get(conditional.when);
        if (conditional && parent) {
            parent.conditionals.push({ question, eq: conditional.eq });
        }
    });

    return groups;
};

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
        return {
            title: page.title,
            questions: buildQuestionGroups(
                questions.filter((q) => keys.has(q.key)),
                form.conditionals,
            ),
        };
    });
};

import { TypedSurveyData, FlatResultItem } from 'models/analytics/surveyResult';
import { ResultPage, ConditionalLink, conditionKey } from '../surveyPages';

const FREE_TEXT_TYPES = new Set(['simpletextarea', 'simpletextfield']);

const isFreeText = (question: TypedSurveyData) => FREE_TEXT_TYPES.has(question.type);

const toResponses = (question: TypedSurveyData): string[] =>
    (question.result as FlatResultItem[]).map((r) => r.value).filter(Boolean);

const slugify = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

export interface CommentSubSection {
    id: string;
    label: string;
    responses: string[];
}

export interface CommentSection {
    id: string;
    title: string;
    pageTitle: string;
    // 1-based position of the page in the survey, includes every wizard page
    pageNumber: number;
    commentCount: number;
    // Present only for a question asked once per matrix row behind one condition - each row becomes
    // a labeled subsection in the body and a sub-entry in the sidebar TOC.
    subSections?: CommentSubSection[];
    // Present for every other question (no subSections).
    responses?: string[];
}

/**
 * Title for a section merging several row follow-ups. Authors either repeat one question across
 * the rows ("Why is this component important to you?", which is the title) or tailor it per row
 * ("Why is air quality important to you?"), in which case no single follow-up speaks for the
 * group and the question they all hang off does.
 */
const mergedTitle = (group: TypedSurveyData[], link: ConditionalLink) => {
    const [first] = group;
    const sharedLabel = group.every((question) => question.label === first.label);
    return sharedLabel ? first.label : link.trigger_label || first.label;
};

/**
 * Label for one row within a merged section. The row alone is enough when every follow-up asked
 * the same question; when they differ, the row's own wording would otherwise be lost.
 */
const mergedSubLabel = (question: TypedSurveyData, rowLabel: string, sharedLabel: boolean) =>
    sharedLabel ? rowLabel : `${rowLabel}: ${question.label}`;

/**
 * Groups every free-text (simpletextarea/simpletextfield) question across the survey's result pages
 * into comment sections for the Comments tab. Each question is its own section titled with the
 * question. The one exception is a conditional follow-up repeated per matrix
 * row: those collapse into a single section for the question, with a subsection per row.
 */
export const buildCommentSections = (
    pages: ResultPage[] | null,
    conditionalLinks: Record<string, ConditionalLink> = {},
): CommentSection[] => {
    if (!pages) {
        return [];
    }

    const sections: CommentSection[] = [];

    pages.forEach((page, pageIndex) => {
        const freeTextQuestions = page.questions.filter(isFreeText);
        if (!freeTextQuestions.length) {
            return;
        }

        const rowFollowUps = new Map<string, TypedSurveyData[]>();
        freeTextQuestions.forEach((question) => {
            const link = conditionalLinks[question.key];
            // A follow-up with no row_label hangs off a plain radio/select rather than a matrix row,
            // leave it in a section of its own.
            if (!link?.row_label) {
                return;
            }
            const key = conditionKey(link);
            const group = rowFollowUps.get(key);
            if (group) {
                group.push(question);
            } else {
                rowFollowUps.set(key, [question]);
            }
        });

        const merged = new Set<string>();

        freeTextQuestions.forEach((question) => {
            if (merged.has(question.key)) {
                return;
            }

            const link = conditionalLinks[question.key];
            const group = link?.row_label ? rowFollowUps.get(conditionKey(link)) : undefined;

            // A lone row follow-up has no siblings reads as a plain question
            if (link && group && group.length > 1) {
                group.forEach((member) => merged.add(member.key));
                const sharedLabel = group.every((member) => member.label === question.label);
                const subSections: CommentSubSection[] = group.map((member) => {
                    const rowLabel = conditionalLinks[member.key]?.row_label;
                    return {
                        id: slugify(`sub-${member.key}`),
                        label: rowLabel ? mergedSubLabel(member, rowLabel, sharedLabel) : member.label,
                        responses: toResponses(member),
                    };
                });
                sections.push({
                    id: slugify(`section-${question.key}`),
                    title: mergedTitle(group, link),
                    pageTitle: page.title,
                    pageNumber: pageIndex + 1,
                    commentCount: subSections.reduce((sum, s) => sum + s.responses.length, 0),
                    subSections,
                });
                return;
            }

            const responses = toResponses(question);
            sections.push({
                id: slugify(`section-${question.key}`),
                title: question.label,
                pageTitle: page.title,
                pageNumber: pageIndex + 1,
                commentCount: responses.length,
                responses,
            });
        });
    });

    return sections;
};

export default buildCommentSections;

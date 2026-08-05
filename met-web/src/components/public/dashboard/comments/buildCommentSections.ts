import { TypedSurveyData, FlatResultItem } from 'models/analytics/surveyResult';
import { ResultPage } from '../surveyPages';

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
    commentCount: number;
    // Present only when the source page has more than one free-text question - each becomes
    // a labeled subsection in the body and a sub-entry in the sidebar TOC.
    subSections?: CommentSubSection[];
    // Present only when the section has a single free-text question (no subSections).
    responses?: string[];
}

/**
 * Groups every free-text (simpletextarea/simpletextfield) question across the survey's
 * result pages into comment sections for the Comments tab. A page with exactly one
 * free-text question becomes its own section (titled with the question label); a page
 * with several becomes one section per page, with each question exposed as a sub-section
 * (e.g. a "Valued Components" page where each component has its own free-text question).
 */
export const buildCommentSections = (pages: ResultPage[] | null): CommentSection[] => {
    if (!pages) {
        return [];
    }

    const sections: CommentSection[] = [];

    pages.forEach((page) => {
        const freeTextQuestions = page.questions.filter(isFreeText);
        if (!freeTextQuestions.length) {
            return;
        }

        // Only treat multiple free-text questions as sub-sections of one shared section when
        // they genuinely came from the same named wizard page (e.g. "Valued Components"). When
        // there's no page title to group under (non-wizard forms), each question is its own
        // section instead of being lumped together under a blank title.
        if (freeTextQuestions.length === 1 || !page.title) {
            freeTextQuestions.forEach((question) => {
                const responses = toResponses(question);
                sections.push({
                    id: slugify(`section-${question.key}`),
                    title: question.label,
                    pageTitle: page.title,
                    commentCount: responses.length,
                    responses,
                });
            });
            return;
        }

        const subSections: CommentSubSection[] = freeTextQuestions.map((question) => ({
            id: slugify(`sub-${question.key}`),
            label: question.label,
            responses: toResponses(question),
        }));

        sections.push({
            id: slugify(`section-${page.title}`),
            title: page.title,
            pageTitle: page.title,
            commentCount: subSections.reduce((sum, s) => sum + s.responses.length, 0),
            subSections,
        });
    });

    return sections;
};

export default buildCommentSections;

import { useEffect, useState } from 'react';
import axios from 'axios';
import { getGroupedComments } from 'services/commentService';
import { getSurveyForDashboard } from 'services/surveyService';
import { GroupedComment } from 'models/comment';
import { TypedSurveyData, TypedSurveyResultData } from 'models/analytics/surveyResult';
import { buildResultPages, ResultPage, DashboardSurveyForm } from '../surveyPages';

interface UseSurveyCommentsResult {
    data: TypedSurveyResultData | null;
    pages: ResultPage[] | null;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
}

const toTypedSurveyData = (comments: GroupedComment[]): TypedSurveyData[] =>
    comments.map((comment, index) => ({
        label: comment.label,
        position: index,
        key: comment.key,
        type: comment.type,
        result: comment.comments.map((text) => ({ value: text, count: 1 })),
    }));

/**
 * Fetches free-text (comment) questions grouped by question from met-api - the actual source
 * of truth for submitted comments - plus the survey's wizard-page layout so the Comments tab
 * can still group multi-question pages (e.g. "Valued Components") the same way
 * useSurveyResultPages does for the Survey Results tab.
 */
export const useSurveyComments = (
    engagementId: number | undefined,
    surveyId: number | undefined,
    dashboardType: string,
): UseSurveyCommentsResult => {
    const [data, setData] = useState<TypedSurveyResultData | null>(null);
    const [form, setForm] = useState<DashboardSurveyForm | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        setIsError(false);
        try {
            const [comments, survey] = await Promise.all([
                surveyId ? getGroupedComments({ survey_id: surveyId }) : Promise.resolve([]),
                surveyId ? getSurveyForDashboard(surveyId).catch(() => undefined) : Promise.resolve(undefined),
            ]);
            setData({ data: toTypedSurveyData(comments) });
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
        if (Number(engagementId)) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engagementId, surveyId]);

    const pages = data?.data?.length ? buildResultPages(form, data.data) : null;

    return { data, pages, isLoading, isError, refetch: fetchData };
};

export default useSurveyComments;

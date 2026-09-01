import { useEffect, useState } from 'react';
import axios from 'axios';
import { getSurveyResultData } from 'services/analytics/surveyResult';
import { getSurveyForDashboard } from 'services/surveyService';
import { TypedSurveyResultData } from 'models/analytics/surveyResult';
import { buildResultPages, ResultPage, DashboardSurveyForm, ConditionalLink } from '../surveyPages';
import { UnavailableReason, toUnavailableReason } from '../reportAvailability';

interface UseSurveyResultPagesResult {
    data: TypedSurveyResultData | null;
    pages: ResultPage[] | null;
    conditionalLinks: Record<string, ConditionalLink>;
    questionDescriptions: Record<string, string>;
    isLoading: boolean;
    isError: boolean;
    // Why the report is being withheld (see UnavailableReason), or null when it isn't. Staff
    // excluded a whole engagement's report rather than this survey having nothing to show, so
    // it is reported apart from the empty case.
    unavailableReason: UnavailableReason | null;
    refetch: () => void;
}

/**
 * Fetches type-aware survey result data plus the survey's wizard-page layout, and groups
 * the results into pages via buildResultPages. Shared by the Survey Results and Comments
 * tabs on the public dashboard so both can page/group results the same way.
 */
export const useSurveyResultPages = (
    engagementId: number | undefined,
    surveyId: number | undefined,
    dashboardType: string,
): UseSurveyResultPagesResult => {
    const [data, setData] = useState<TypedSurveyResultData | null>(null);
    const [form, setForm] = useState<DashboardSurveyForm | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [unavailableReason, setUnavailableReason] = useState<UnavailableReason | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        setIsError(false);
        setUnavailableReason(null);
        try {
            const [response, survey] = await Promise.all([
                getSurveyResultData(Number(engagementId), dashboardType),
                surveyId
                    ? getSurveyForDashboard(surveyId, dashboardType).catch(() => undefined)
                    : Promise.resolve(undefined),
            ]);
            setData(response as unknown as TypedSurveyResultData);
            setForm(survey);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 403) {
                setData(null);
                setUnavailableReason(toUnavailableReason(error.response.data));
            } else if (axios.isAxiosError(error) && error.response?.status === 404) {
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
    }, [engagementId]);

    const pages = data?.data?.length ? buildResultPages(form, data.data) : null;

    return {
        data,
        pages,
        conditionalLinks: form?.conditional_links ?? {},
        questionDescriptions: form?.question_descriptions ?? {},
        isLoading,
        isError,
        unavailableReason,
        refetch: fetchData,
    };
};

export default useSurveyResultPages;

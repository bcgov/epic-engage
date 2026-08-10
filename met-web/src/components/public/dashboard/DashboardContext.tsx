import React, { createContext, useEffect, useState } from 'react';
import { SubmissionStatus } from 'constants/engagementStatus';
import { useAppDispatch, useAppSelector } from 'hooks';
import { Engagement, createDefaultEngagement } from 'models/engagement';
import { useNavigate, useParams } from 'react-router-dom';
import { getEngagement } from 'services/engagementService';
import { openNotification } from 'services/notificationService/notificationSlice';
import { getErrorMessage } from 'utils';
import { getEngagementIdBySlug } from 'services/engagementSlugService';
import { getSurvey } from 'services/surveyService';
import { Survey } from 'models/survey';
import { DashboardType } from 'constants/dashboardType';

export interface DashboardContextState {
    engagement: Engagement;
    isEngagementLoading: boolean;
    dashboardType: string;
    originSurvey: Survey | null;
}

export const DashboardContext = createContext<DashboardContextState>({
    engagement: createDefaultEngagement(),
    isEngagementLoading: true,
    dashboardType: DashboardType.PUBLIC,
    originSurvey: null,
});

interface DashboardContextProviderProps {
    children: React.ReactNode;
}

type EngagementParams = {
    engagementId?: string;
    slug?: string;
    surveyId?: string;
    dashboardType?: string;
};

export const DashboardContextProvider = ({ children }: DashboardContextProviderProps) => {
    const {
        engagementId: engagementIdParam,
        slug,
        surveyId,
        dashboardType: dashboardTypeParam,
    } = useParams<EngagementParams>();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const roles = useAppSelector((state) => state.user.roles);

    const [engagementId, setEngagementId] = useState<number | null>(
        engagementIdParam ? Number(engagementIdParam) : null,
    );

    const [engagement, setEngagement] = useState<Engagement>(createDefaultEngagement());
    const [isEngagementLoading, setEngagementLoading] = useState(true);
    const [originSurvey, setOriginSurvey] = useState<Survey | null>(null);

    const dashboardType = dashboardTypeParam ? dashboardTypeParam : DashboardType.PUBLIC;

    const validateEngagement = (engagementToValidate: Engagement) => {
        // submission status e.g. of pending or draft will have id less than of Open
        const neverOpened = [SubmissionStatus.Upcoming].includes(engagementToValidate?.submission_status);

        if (neverOpened) {
            throw new Error('Engagement has not yet been opened');
        }

        const isClosed = engagementToValidate?.submission_status === SubmissionStatus.Closed;
        const canAccessDashboard = !roles.includes('access_dashboard');

        /* check to ensure that users without the role access_dashboard can access the dashboard only after 
        the engagement is closed*/
        if (!isClosed && canAccessDashboard) {
            throw new Error(
                'The report will only be available to view after the engagement period is over and the engagement is closed.',
            );
        }
    };

    const fetchEngagement = async () => {
        // The slug and survey routes resolve the engagement id asynchronously.
        if (!engagementId && (slug || surveyId)) {
            return;
        }
        if (isNaN(Number(engagementId))) {
            navigate('/not-found');
            return;
        }
        try {
            const result = await getEngagement(Number(engagementId));
            validateEngagement(result);
            setEngagement({ ...result });
            setEngagementLoading(false);
        } catch (error) {
            dispatch(
                openNotification({
                    severity: 'error',
                    text: getErrorMessage(error) || 'Error occurred while fetching Engagement information',
                }),
            );
        }
    };
    useEffect(() => {
        fetchEngagement();
    }, [engagementId]);

    const handleFetchEngagementIdBySlug = async () => {
        if (!slug) {
            return;
        }
        try {
            const result = await getEngagementIdBySlug(slug);
            setEngagementId(result.engagement_id);
        } catch (error) {
            navigate('/not-found');
        }
    };

    useEffect(() => {
        handleFetchEngagementIdBySlug();
    }, [slug]);

    const handleFetchOriginSurvey = async () => {
        if (!surveyId) {
            return;
        }
        try {
            const result = await getSurvey(Number(surveyId));
            setOriginSurvey(result);
            setEngagementId(result.engagement_id);
        } catch (error) {
            navigate('/not-found');
        }
    };

    useEffect(() => {
        handleFetchOriginSurvey();
    }, [surveyId]);

    return (
        <DashboardContext.Provider
            value={{
                engagement,
                isEngagementLoading,
                dashboardType,
                originSurvey,
            }}
        >
            {children}
        </DashboardContext.Provider>
    );
};

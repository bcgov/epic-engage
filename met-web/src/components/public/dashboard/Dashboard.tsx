import { useContext, useState } from 'react';
import { Box } from '@mui/material';
import { useParams, useSearchParams } from 'react-router-dom';
import { When } from 'react-if';
import { SurveyResultsCharts } from './SurveyResultsCharts';
import { CommentsTab } from './comments/CommentsTab';
import { Breadcrumb, BreadcrumbItem } from './Breadcrumb';
import { DashboardHeaderCard } from './DashboardHeaderCard';
import { DashboardTabBar, RESULTS_TAB, COMMENTS_TAB } from './DashboardTabBar';
import { DashboardContext } from './DashboardContext';
import { DashboardType } from 'constants/dashboardType';
import { useAppSelector } from 'hooks';
import { Palette } from 'styles/Theme';

const Dashboard = () => {
    const { slug } = useParams();
    const [searchParams] = useSearchParams();
    const { engagement, isEngagementLoading, dashboardType, originSurvey } = useContext(DashboardContext);
    const isLoggedIn = useAppSelector((state) => state.user.authentication.authenticated);
    const initialTab = searchParams.get('tab') === COMMENTS_TAB ? COMMENTS_TAB : RESULTS_TAB;
    const [activeTab, setActiveTab] = useState(initialTab);
    const [hasViewedComments, setHasViewedComments] = useState(initialTab === COMMENTS_TAB);
    const basePath = slug ? `/${slug}` : `/engagements/${engagement?.id}/view`;
    const reportLabel = dashboardType === DashboardType.INTERNAL ? 'Internal Report' : 'Public Report';

    /* The report is reachable from both the Surveys and the Engagements listings. Retrace whichever
    route the user took. */
    const breadcrumbItems: BreadcrumbItem[] = originSurvey
        ? [
              { label: 'Surveys', to: '/surveys' },
              { label: originSurvey.name, to: `/surveys/${originSurvey.id}/submit` },
              { label: reportLabel },
          ]
        : [
              // Signed-out visitors have no /engagements listing; the landing page is their engagement browser.
              { label: 'Engagements', to: isLoggedIn ? '/engagements' : '/' },
              { label: engagement.name, to: basePath },
              { label: reportLabel },
          ];

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        if (tab === COMMENTS_TAB) {
            setHasViewedComments(true);
        }
    };

    return (
        <Box sx={{ pt: 3 }}>
            <Breadcrumb items={breadcrumbItems} />
            <DashboardHeaderCard engagement={engagement} engagementIsLoading={isEngagementLoading} />
            <DashboardTabBar activeTab={activeTab} onChange={handleTabChange} />
            <Box sx={{ backgroundColor: Palette.background.default }}>
                <Box
                    sx={{
                        display: activeTab === RESULTS_TAB ? 'block' : 'none',
                        maxWidth: 1100,
                        mx: 'auto',
                        px: { xs: 2, md: 3 },
                    }}
                >
                    <SurveyResultsCharts
                        engagement={engagement}
                        engagementIsLoading={isEngagementLoading}
                        dashboardType={dashboardType}
                    />
                </Box>
                <When condition={activeTab === COMMENTS_TAB || hasViewedComments}>
                    <Box
                        sx={{
                            display: activeTab === COMMENTS_TAB ? 'block' : 'none',
                            px: { xs: 2, md: 3 },
                            py: 2,
                        }}
                    >
                        <CommentsTab
                            engagement={engagement}
                            engagementIsLoading={isEngagementLoading}
                            dashboardType={dashboardType}
                        />
                    </Box>
                </When>
            </Box>
        </Box>
    );
};

export default Dashboard;

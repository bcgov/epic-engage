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
import { ReportUnavailable } from './ReportUnavailable';
import { UnavailableReason } from './reportAvailability';
import { DashboardType } from 'constants/dashboardType';
import { TypedSurveyData } from 'models/analytics/surveyResult';
import { openNotification } from 'services/notificationService/notificationSlice';
import { useAppDispatch, useAppSelector } from 'hooks';
import { ChartsPngExport } from './ChartsPngExport';
import { chartFileName, isSuperuser } from './exportCharts';
import { Palette } from 'styles/Theme';

const Dashboard = () => {
    const { slug } = useParams();
    const [searchParams] = useSearchParams();
    const { engagement, isEngagementLoading, dashboardType, originSurvey } = useContext(DashboardContext);
    const dispatch = useAppDispatch();
    const isLoggedIn = useAppSelector((state) => state.user.authentication.authenticated);
    const userGroups = useAppSelector((state) => state.user.userDetail.groups);
    // Superusers may take any chart from the internal report on its own, even one kept off the public report.
    const canDownloadCharts = dashboardType === DashboardType.INTERNAL && isSuperuser(userGroups);
    const [chartDownload, setChartDownload] = useState<{ chart: TypedSurveyData; description?: string } | null>(null);
    const initialTab = searchParams.get('tab') === COMMENTS_TAB ? COMMENTS_TAB : RESULTS_TAB;
    const [activeTab, setActiveTab] = useState(initialTab);
    const [hasViewedComments, setHasViewedComments] = useState(initialTab === COMMENTS_TAB);
    const [unavailableReason, setUnavailableReason] = useState<UnavailableReason | null>(null);
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

    const handleDownloadChart = (chart: TypedSurveyData, description?: string) => {
        // One capture at a time; a second click while one is being drawn is dropped.
        if (!chartDownload) {
            setChartDownload({ chart, description });
        }
    };

    const handleChartDownloadDone = (error?: unknown) => {
        setChartDownload(null);
        if (error) {
            dispatch(
                openNotification({
                    severity: 'error',
                    text: 'Error occurred while exporting the chart. Please try again later.',
                }),
            );
        }
    };

    return (
        <Box sx={{ pt: 3 }}>
            <Breadcrumb items={breadcrumbItems} />
            <DashboardHeaderCard engagement={engagement} engagementIsLoading={isEngagementLoading} />
            {unavailableReason && <ReportUnavailable reason={unavailableReason} />}
            <When condition={!unavailableReason}>
                <DashboardTabBar activeTab={activeTab} onChange={handleTabChange} />
            </When>
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
                        onUnavailable={setUnavailableReason}
                        onDownloadChart={canDownloadCharts ? handleDownloadChart : undefined}
                    />
                    {chartDownload && (
                        <ChartsPngExport
                            engagementName={engagement.name}
                            charts={[chartDownload.chart]}
                            descriptions={
                                chartDownload.description
                                    ? { [chartDownload.chart.key]: chartDownload.description }
                                    : {}
                            }
                            fileName={chartFileName(engagement.name, chartDownload.chart)}
                            onDone={handleChartDownloadDone}
                        />
                    )}
                </Box>
                <When condition={!unavailableReason && (activeTab === COMMENTS_TAB || hasViewedComments)}>
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

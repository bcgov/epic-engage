import { useContext, useState } from 'react';
import { Box } from '@mui/material';
import { useParams } from 'react-router-dom';
import { When } from 'react-if';
import { SurveyResultsCharts } from './SurveyResultsCharts';
import { CommentsTab } from './comments/CommentsTab';
import { Breadcrumb } from './Breadcrumb';
import { DashboardHeaderCard } from './DashboardHeaderCard';
import { DashboardTabBar, RESULTS_TAB, COMMENTS_TAB } from './DashboardTabBar';
import { DashboardContext } from './DashboardContext';

const Dashboard = () => {
    const { slug } = useParams();
    const { engagement, isEngagementLoading, dashboardType } = useContext(DashboardContext);
    const [activeTab, setActiveTab] = useState(RESULTS_TAB);
    const [hasViewedComments, setHasViewedComments] = useState(false);
    const basePath = slug ? `/${slug}` : `/engagements/${engagement?.id}/view`;

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        if (tab === COMMENTS_TAB) {
            setHasViewedComments(true);
        }
    };

    return (
        <Box sx={{ pt: 3 }}>
            <Breadcrumb
                items={[
                    { label: 'Engagements', to: '/' },
                    { label: engagement.name, to: basePath },
                    { label: 'Public Report' },
                ]}
            />
            <DashboardHeaderCard engagement={engagement} engagementIsLoading={isEngagementLoading} />
            <DashboardTabBar activeTab={activeTab} onChange={handleTabChange} />
            <Box sx={{ backgroundColor: '#FFFFFF' }}>
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

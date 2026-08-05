import { Box, Tab, Tabs } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import { Palette } from 'styles/Theme';

export const RESULTS_TAB = 'results';
export const COMMENTS_TAB = 'comments';

interface DashboardTabBarProps {
    activeTab: string;
    onChange: (tab: string) => void;
}

export const DashboardTabBar = ({ activeTab, onChange }: DashboardTabBarProps) => {
    return (
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 1, backgroundColor: Palette.background.light }}>
            <Tabs
                value={activeTab}
                onChange={(_event, value: string) => onChange(value)}
                sx={{
                    minHeight: 0,
                    '& .MuiTab-root': {
                        minHeight: 0,
                        py: 1.5,
                        px: 2.5,
                        fontSize: 16,
                        fontWeight: 400,
                        color: Palette.text.secondary,
                        textTransform: 'none',
                    },
                    '& .MuiTab-root.Mui-selected': {
                        color: Palette.primary.main,
                        fontWeight: 700,
                    },
                    '& .MuiTabs-indicator': {
                        backgroundColor: Palette.primary.main,
                        height: '3px',
                    },
                }}
            >
                <Tab icon={<BarChartIcon fontSize="small" />} iconPosition="start" label="Survey Results" value={RESULTS_TAB} />
                <Tab icon={<ForumOutlinedIcon fontSize="small" />} iconPosition="start" label="Comments" value={COMMENTS_TAB} />
            </Tabs>
        </Box>
    );
};

export default DashboardTabBar;

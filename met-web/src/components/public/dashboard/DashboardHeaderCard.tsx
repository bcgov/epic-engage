import { useContext, useEffect, useState } from 'react';
import { Box, Skeleton, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { PrimaryButton } from 'components/shared/common';
import { Engagement } from 'models/engagement';
import { UserResponseDetailByMonth } from 'models/analytics/userResponseDetail';
import { getAggregatorData } from 'services/analytics/aggregatorService';
import { getMapData } from 'services/analytics/mapService';
import { getUserResponseDetailByMonth } from 'services/analytics/userResponseDetailService';
import { useAppSelector } from 'hooks';
import { DashboardType } from 'constants/dashboardType';
import { DashboardContext } from './DashboardContext';
import { LiveActivityChart } from './LiveActivityChart';

interface DashboardHeaderCardProps {
    engagement: Engagement;
    engagementIsLoading: boolean;
}

const statLabelSx = {
    fontSize: 10,
    color: '#898785',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
};

const statValueSx = {
    fontSize: 13,
    color: '#2D2D2D',
};

const statSeparator = <Box sx={{ width: '1px', height: 28, backgroundColor: '#D8D8D8', mr: 2 }} />;

// Backend returns showdataby as "YYYY-Mon" (e.g. "2024-Jan"); the header displays "Mon YYYY".
const formatMonthLabel = (showdataby: string) => {
    const [year, month] = showdataby.split('-');
    return month && year ? `${month} ${year}` : showdataby;
};

export const DashboardHeaderCard = ({ engagement, engagementIsLoading }: DashboardHeaderCardProps) => {
    const { dashboardType } = useContext(DashboardContext);
    const isAuthenticated = useAppSelector((state) => state.user.authentication.authenticated);
    const canExport = dashboardType === DashboardType.INTERNAL && isAuthenticated;
    const [surveysCompleted, setSurveysCompleted] = useState<number | null>(null);
    const [isLocationLoading, setIsLocationLoading] = useState(true);
    const [projectLocation, setProjectLocation] = useState<string | null>(null);
    const [activity, setActivity] = useState<UserResponseDetailByMonth[]>([]);
    const [isActivityOpen, setIsActivityOpen] = useState(false);

    useEffect(() => {
        if (!Number(engagement.id)) {
            return;
        }
        getAggregatorData({ engagement_id: Number(engagement.id), count_for: 'survey_completed' })
            .then((data) => setSurveysCompleted(data.value))
            .catch(() => setSurveysCompleted(null));
        setIsLocationLoading(true);
        getMapData(Number(engagement.id))
            .then((data) => setProjectLocation(data.marker_label ?? null))
            .catch(() => setProjectLocation(null))
            .finally(() => setIsLocationLoading(false));
        getUserResponseDetailByMonth(Number(engagement.id), '', '')
            .then((data) => setActivity(Array.isArray(data) ? data : []))
            .catch(() => setActivity([]));
    }, [engagement.id]);

    const peakMonth = activity.reduce<UserResponseDetailByMonth | null>(
        (peak, current) => (!peak || current.responses > peak.responses ? current : peak),
        null,
    );

    return (
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, backgroundColor: '#FAF9F8' }}>
            <Box sx={{ backgroundColor: '#FFFFFF', border: '1px solid #D8D8D8', borderRadius: '8px', p: '18px 24px 16px' }}>
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems="flex-start"
                    gap={2}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#013366' }}>
                            What We Heard
                        </Typography>
                        <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ mt: 1.25 }}>
                            <Stack sx={{ pr: 2 }}>
                                <Typography sx={statLabelSx}>Surveys completed</Typography>
                                {engagementIsLoading || surveysCompleted === null ? (
                                    <Skeleton width={40} />
                                ) : (
                                    <Typography sx={statValueSx}>{surveysCompleted.toLocaleString()}</Typography>
                                )}
                            </Stack>
                            {(isLocationLoading || projectLocation) && (
                                <>
                                    {statSeparator}
                                    <Stack sx={{ pr: 2 }}>
                                        <Typography sx={statLabelSx}>Project location</Typography>
                                        {isLocationLoading ? (
                                            <Skeleton width={80} />
                                        ) : (
                                            <Typography sx={statValueSx}>{projectLocation}</Typography>
                                        )}
                                    </Stack>
                                </>
                            )}
                            {activity.length > 0 && (
                                <>
                                    {statSeparator}
                                    <Box
                                        component="button"
                                        type="button"
                                        onClick={() => setIsActivityOpen((open) => !open)}
                                        sx={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontFamily: 'inherit',
                                            textAlign: 'left',
                                            p: 0,
                                            pr: 2,
                                            '&:hover': { opacity: 0.8 },
                                        }}
                                    >
                                        <Typography sx={statLabelSx}>Live activity</Typography>
                                        <Stack direction="row" alignItems="center" gap={0.5}>
                                            <Typography sx={statValueSx}>
                                                {peakMonth ? `${formatMonthLabel(peakMonth.showdataby)} · Peak month` : ''}
                                            </Typography>
                                            <ExpandMoreIcon
                                                sx={{
                                                    fontSize: 14,
                                                    color: '#898785',
                                                    transform: isActivityOpen ? 'rotate(180deg)' : 'none',
                                                    transition: 'transform .2s',
                                                }}
                                            />
                                        </Stack>
                                    </Box>
                                </>
                            )}
                        </Stack>
                        {isActivityOpen && activity.length > 0 && (
                            <Box sx={{ mt: 1.75, pt: 1.5, borderTop: '1px solid #D8D8D8' }}>
                                <LiveActivityChart
                                    data={activity.map((d) => ({
                                        label: formatMonthLabel(d.showdataby),
                                        count: d.responses,
                                    }))}
                                />
                            </Box>
                        )}
                    </Box>
                    {canExport && (
                        <PrimaryButton startIcon={<FileDownloadOutlinedIcon />} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                            Export
                        </PrimaryButton>
                    )}
                </Stack>
            </Box>
        </Box>
    );
};

export default DashboardHeaderCard;

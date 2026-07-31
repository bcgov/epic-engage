import { useContext, useEffect, useState } from 'react';
import { Box, Menu, MenuItem, Skeleton, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import { PrimaryButton } from 'components/shared/common';
import { Engagement } from 'models/engagement';
import { UserResponseDetailByMonth } from 'models/analytics/userResponseDetail';
import { getAggregatorData } from 'services/analytics/aggregatorService';
import { getMapData } from 'services/analytics/mapService';
import { getUserResponseDetailByMonth } from 'services/analytics/userResponseDetailService';
import { getDashboardDataSheet } from 'services/surveyService';
import { USER_ROLES } from 'services/userService/constants';
import { openNotification } from 'services/notificationService/notificationSlice';
import { useAppDispatch, useAppSelector } from 'hooks';
import { DashboardType } from 'constants/dashboardType';
import { downloadFile } from 'utils';
import { formatToUTC } from 'utils/helpers/dateHelper';
import { DashboardContext } from './DashboardContext';
import { LiveActivityChart } from './LiveActivityChart';
import { Palette } from 'styles/Theme';

interface DashboardHeaderCardProps {
    engagement: Engagement;
    engagementIsLoading: boolean;
}

const statLabelSx = {
    fontSize: 10,
    color: Palette.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
};

const statValueSx = {
    fontSize: 13,
    color: Palette.text.primary,
};

const statSeparator = <Box sx={{ width: '1px', height: 28, backgroundColor: Palette.border.default, mr: 2 }} />;

// Backend returns showdataby as "YYYY-Mon" (e.g. "2024-Jan"); the header displays "Mon YYYY".
const formatMonthLabel = (showdataby: string) => {
    const [year, month] = showdataby.split('-');
    return month && year ? `${month} ${year}` : showdataby;
};

export const DashboardHeaderCard = ({ engagement, engagementIsLoading }: DashboardHeaderCardProps) => {
    const { dashboardType } = useContext(DashboardContext);
    const dispatch = useAppDispatch();
    const isAuthenticated = useAppSelector((state) => state.user.authentication.authenticated);
    const roles = useAppSelector((state) => state.user.roles);
    const canExport =
        dashboardType === DashboardType.INTERNAL &&
        isAuthenticated &&
        roles.includes(USER_ROLES.EXPORT_INTERNAL_COMMENT_SHEET);
    const surveyId = engagement.surveys?.[0]?.id;
    const [surveysCompleted, setSurveysCompleted] = useState<number | null>(null);
    const [isLocationLoading, setIsLocationLoading] = useState(true);
    const [projectLocation, setProjectLocation] = useState<string | null>(null);
    const [activity, setActivity] = useState<UserResponseDetailByMonth[]>([]);
    const [isActivityOpen, setIsActivityOpen] = useState(false);
    const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    const handleExportCsv = async () => {
        if (!surveyId) {
            return;
        }
        setExportAnchorEl(null);
        try {
            setIsExporting(true);
            const response = await getDashboardDataSheet(Number(surveyId));
            const timestamp = formatToUTC(Date(), 'YYYY-MM-DD');
            downloadFile(response, `INTERNAL ONLY - ${engagement.name} - Dashboard Data - ${timestamp}.xlsx`);
        } catch (error) {
            dispatch(
                openNotification({
                    severity: 'error',
                    text: 'Error occurred while exporting dashboard data. Please try again later.',
                }),
            );
        } finally {
            setIsExporting(false);
        }
    };

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
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, backgroundColor: Palette.background.light }}>
            <Box sx={{ backgroundColor: Palette.background.default, border: `1px solid ${Palette.border.default}`, borderRadius: '8px', p: '18px 24px 16px' }}>
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems="flex-start"
                    gap={2}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: Palette.primary.main }}>
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
                                                    color: Palette.text.muted,
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
                            <Box sx={{ mt: 1.75, pt: 1.5, borderTop: `1px solid ${Palette.border.default}` }}>
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
                        <>
                            <PrimaryButton
                                startIcon={<FileDownloadOutlinedIcon />}
                                endIcon={
                                    <ExpandMoreIcon
                                        sx={{
                                            transition: 'transform .2s',
                                            transform: exportAnchorEl ? 'rotate(180deg)' : 'none',
                                        }}
                                    />
                                }
                                onClick={(event) => setExportAnchorEl(event.currentTarget)}
                                loading={isExporting}
                                disabled={!surveyId}
                                aria-haspopup="true"
                                aria-controls={exportAnchorEl ? 'dashboard-export-menu' : undefined}
                                aria-expanded={Boolean(exportAnchorEl)}
                                sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                            >
                                Export
                            </PrimaryButton>
                            <Menu
                                id="dashboard-export-menu"
                                anchorEl={exportAnchorEl}
                                open={Boolean(exportAnchorEl)}
                                onClose={() => setExportAnchorEl(null)}
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                                slotProps={{ paper: { sx: { minWidth: 260 } } }}
                            >
                                <MenuItem
                                    onClick={handleExportCsv}
                                    sx={{ alignItems: 'center', gap: 1.25, py: 1.25, whiteSpace: 'normal' }}
                                >
                                    <TableChartOutlinedIcon sx={{ fontSize: 18, color: Palette.primary.main }} />
                                    <Box>
                                        <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                                            Excel Data Export
                                        </Typography>
                                        <Typography sx={{ fontSize: 11, color: Palette.text.muted, lineHeight: 1.35 }}>
                                            Raw and aggregated survey data across 4 sheets
                                        </Typography>
                                    </Box>
                                </MenuItem>
                            </Menu>
                        </>
                    )}
                </Stack>
            </Box>
        </Box>
    );
};

export default DashboardHeaderCard;

import { Box, Stack, Typography } from '@mui/material';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { SubmissionStatus } from 'constants/engagementStatus';
import { DashboardType } from 'constants/dashboardType';
import { formatDate } from 'utils/helpers/dateHelper';
import { Palette } from 'styles/Theme';

const WATERMARK_NOTE = 'Survey is open - results are subject to change';

interface ResultsAsOfWatermarkProps {
    submissionStatus: SubmissionStatus;
    dashboardType: string;
    dataAsOf: Date | null;
}

export const ResultsAsOfWatermark = ({ submissionStatus, dashboardType, dataAsOf }: ResultsAsOfWatermarkProps) => {
    const isOpen = submissionStatus === SubmissionStatus.Open;
    if (!dataAsOf || !isOpen || dashboardType !== DashboardType.PUBLIC) {
        return null;
    }

    const timestamp = `${formatDate(dataAsOf.toISOString(), 'MMM D, YYYY, h:mm A')} (PT)`;

    return (
        <Stack
            direction="row"
            alignItems="center"
            gap={1.25}
            sx={{
                backgroundColor: Palette.dashboard.asOf.bg,
                border: `1px solid ${Palette.dashboard.asOf.border}`,
                borderRadius: '8px',
                p: '10px 18px',
                flexShrink: 0,
                alignSelf: { xs: 'stretch', sm: 'center' },
            }}
        >
            <ScheduleOutlinedIcon sx={{ fontSize: 22, color: Palette.dashboard.asOf.label, flexShrink: 0 }} />
            <Box>
                <Typography
                    sx={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: Palette.dashboard.asOf.label,
                        lineHeight: 1.3,
                    }}
                >
                    Results as of
                </Typography>
                <Typography
                    sx={{ fontSize: 15, fontWeight: 700, color: Palette.dashboard.asOf.value, lineHeight: 1.3 }}
                >
                    {timestamp}
                </Typography>
                <Typography sx={{ fontSize: 11, color: Palette.dashboard.asOf.label, lineHeight: 1.4, mt: '3px' }}>
                    {WATERMARK_NOTE}
                </Typography>
            </Box>
        </Stack>
    );
};

export default ResultsAsOfWatermark;

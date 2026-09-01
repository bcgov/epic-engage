import { Box } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { MetPaper, MetHeader4, MetBody } from 'components/shared/common';
import { useAppSelector } from 'hooks';
import { USER_ROLES } from 'services/userService/constants';
import { UNAVAILABLE_REASON, UnavailableReason } from './reportAvailability';
import { Palette } from 'styles/Theme';

interface ReportUnavailableProps {
    reason: UnavailableReason;
}

// Only shown to staff holding the role that would have let them see the report anyway.
// Rhe public is only told the report isn't available.
const STAFF_GUIDANCE: Partial<Record<UnavailableReason, string>> = {
    [UNAVAILABLE_REASON.SEND_REPORT_OFF]:
        "Turn on Send Report under the engagement's Settings tab to make this report public.",
    [UNAVAILABLE_REASON.ENGAGEMENT_UNPUBLISHED]: 'Publish this engagement again to make this report public.',
};

/**
 * Shown in place of the report when the API withholds it. More informative than blanket "No Data Available"
 */
export const ReportUnavailable = ({ reason }: ReportUnavailableProps) => {
    const roles = useAppSelector((state) => state.user.roles);
    const staffGuidance = roles.includes(USER_ROLES.ACCESS_DASHBOARD) ? STAFF_GUIDANCE[reason] : undefined;

    return (
        <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, md: 3 }, py: 4 }}>
            <MetPaper
                data-testid="report-unavailable"
                sx={{ p: 3, display: 'flex', gap: 2, border: `1px solid ${Palette.border.default}` }}
            >
                <InfoOutlinedIcon sx={{ color: Palette.primary.main, mt: '2px' }} />
                <Box>
                    <MetHeader4 sx={{ mb: 1 }}>This report isn&apos;t available</MetHeader4>
                    <MetBody>The report for this engagement has not been made public.</MetBody>
                    {staffGuidance && (
                        <MetBody data-testid="report-unavailable-staff-guidance" sx={{ mt: 2 }}>
                            {staffGuidance}
                        </MetBody>
                    )}
                </Box>
            </MetPaper>
        </Box>
    );
};

export default ReportUnavailable;

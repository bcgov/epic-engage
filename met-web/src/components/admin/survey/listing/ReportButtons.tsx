import React from 'react';
import Stack from '@mui/material/Stack';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from 'hooks';
import { USER_ROLES } from 'services/userService/constants';
import { SubmissionStatus } from 'constants/engagementStatus';
import { Survey } from 'models/survey';
import { SecondaryButton } from 'components/shared/common';
import { Palette } from 'styles/Theme';

export const ReportButtons = ({ survey }: { survey: Survey }) => {
    const navigate = useNavigate();
    const { roles, assignedEngagements } = useAppSelector((state) => state.user);
    const engagement = survey.engagement;
    const engagementId = engagement?.id ?? 0;
    const submissionHasBeenOpened =
        !!engagement && [SubmissionStatus.Open, SubmissionStatus.Closed].includes(engagement.submission_status);
    const canAccess = roles.includes(USER_ROLES.ACCESS_DASHBOARD) || assignedEngagements.includes(engagementId);

    const canViewPublic = submissionHasBeenOpened && canAccess;
    const canViewInternal = canViewPublic && roles.includes(USER_ROLES.VIEW_ALL_SURVEY_RESULTS);

    return (
        <Stack direction="row" spacing={1}>
            <SecondaryButton
                size="small"
                sx={{
                    whiteSpace: 'nowrap',
                    color: Palette.text.primary,
                    border: '1px solid',
                    '&:hover': { border: '1px solid', backgroundColor: '#EBF1F8', color: Palette.text.primary },
                }}
                disabled={!canViewPublic}
                onClick={() => navigate(`/engagements/${engagementId}/dashboard/public`)}
            >
                Public Report
            </SecondaryButton>
            <SecondaryButton
                size="small"
                sx={{
                    whiteSpace: 'nowrap',
                    color: Palette.text.primary,
                    border: '1px solid',
                    '&:hover': { border: '1px solid', backgroundColor: '#EBF1F8', color: Palette.text.primary },
                }}
                disabled={!canViewInternal}
                onClick={() => navigate(`/engagements/${engagementId}/dashboard/internal`)}
            >
                Internal Report
            </SecondaryButton>
        </Stack>
    );
};

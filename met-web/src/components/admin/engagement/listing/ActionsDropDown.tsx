import React, { useMemo, useState } from 'react';
import { USER_ROLES } from 'services/userService/constants';
import { CircularProgress, MenuItem, Select } from '@mui/material';
import { Engagement } from 'models/engagement';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from 'hooks';
import { EngagementStatus } from 'constants/engagementStatus';
import { Palette } from 'styles/Theme';
import { getFormsSheet } from 'services/FormCAC';
import { openNotification } from 'services/notificationService/notificationSlice';
import { formatToUTC } from 'utils/helpers/dateHelper';
import { downloadFile } from 'utils';
import { DeleteEngagementModal } from './DeleteEngagementModal';

interface ActionDropDownItem {
    value: number;
    label: string;
    action?: () => void;
    condition?: boolean;
}
export const ActionsDropDown = ({
    engagement,
    onEngagementDeleted,
}: {
    engagement: Engagement;
    onEngagementDeleted: (id: number) => void;
}) => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const [isExportingCacForms, setIsExportingCacForms] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const { roles, assignedEngagements } = useAppSelector((state) => state.user);

    const canViewSurvey = (): boolean => {
        if (engagement.engagement_status.id !== EngagementStatus.Draft) {
            return true;
        }

        if (engagement.surveys.length === 0) {
            return false;
        }

        return roles.includes(USER_ROLES.VIEW_ALL_SURVEYS) || assignedEngagements.includes(engagement.id);
    };

    const exportCacFormSheet = async () => {
        setIsExportingCacForms(true);
        try {
            const response = await getFormsSheet({ engagement_id: engagement.id });
            downloadFile(response, `cac-${engagement.name}-${formatToUTC(Date())}.csv`);
        } catch (error) {
            dispatch(
                openNotification({ text: 'Error occurred while exporting cac form submissions', severity: 'error' }),
            );
        } finally {
            setIsExportingCacForms(false);
        }
    };

    const canDeleteEngagement: boolean = useMemo(() => {
        if (!roles.includes(USER_ROLES.CREATE_ADMIN_USER)) {
            return false;
        }

        const today = new Date().toISOString().slice(0, 10);
        if (engagement.engagement_status.id === EngagementStatus.Unpublished && today < engagement.start_date) {
            return true;
        }

        return false;
    }, [engagement.engagement_status.id, engagement.start_date, roles]);

    const handleEngagementDeleted = () => {
        onEngagementDeleted(engagement.id);
    };

    const ITEMS: ActionDropDownItem[] = useMemo(
        () => [
            {
                value: 1,
                label: 'View Survey',
                action: () => {
                    navigate(`/surveys/${engagement.surveys[0].id}/submit`);
                },
                condition: canViewSurvey(),
            },
            {
                value: 2,
                label: 'Export Form Sign-Up Data',
                action: () => {
                    exportCacFormSheet();
                },
                condition:
                    roles.includes(USER_ROLES.EXPORT_ALL_CAC_FORM_TO_SHEET) ||
                    (roles.includes(USER_ROLES.EXPORT_CAC_FORM_TO_SHEET) &&
                        assignedEngagements.includes(engagement.id)),
            },
            {
                value: 3,
                label: 'Delete Engagement',
                action: () => {
                    setDeleteModalOpen(true);
                },
                condition: canDeleteEngagement,
            },
        ],
        [engagement.id, canDeleteEngagement],
    );

    if (isExportingCacForms) {
        return <CircularProgress />;
    }

    return (
        <>
            <Select
                id={`action-drop-down-${engagement.id}`}
                value={0}
                fullWidth
                size="small"
                sx={{ backgroundColor: 'white', color: Palette.info.main }}
            >
                <MenuItem value={0} sx={{ fontStyle: 'italic', height: '2em' }} color="info" disabled>
                    {'(Select One)'}
                </MenuItem>
                {ITEMS.filter((item) => item.condition).map((item) => (
                    <MenuItem key={item.value} value={item.value} onClick={item.action}>
                        {item.label}
                    </MenuItem>
                ))}
            </Select>
            <DeleteEngagementModal
                open={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onDelete={handleEngagementDeleted}
                engagement={engagement}
            />
        </>
    );
};

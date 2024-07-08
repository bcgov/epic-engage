import React, { createContext, useContext, useState } from 'react';
import { ActionContext } from '../../ActionContext';
import { EngagementTabsContext } from '../EngagementTabsContext';
import { useAppDispatch } from 'hooks';
import { openNotification } from 'services/notificationService/notificationSlice';
import { SubmissionStatus } from 'constants/engagementStatus';

export interface EngagementSettingsContextState {
    visibility: number;
    setVisibility: (visibility: number) => void;
    sendReport: boolean;
    setSendReport: (sendReport: boolean) => void;
    handleSaveSettings: () => void;
    updatingSettings: boolean;
    hasBeenOpened: boolean;
}

export const EngagementSettingsContext = createContext<EngagementSettingsContextState>({
    visibility: 1,
    setVisibility: () => {
        return;
    },
    sendReport: false,
    setSendReport: () => {
        return;
    },
    handleSaveSettings: () => {
        return;
    },
    updatingSettings: false,
    hasBeenOpened: false,
});

export const EngagementSettingsContextProvider = ({ children }: { children: React.ReactNode }) => {
    const { handleUpdateEngagementMetadataRequest, engagementId, handleUpdateEngagementRequest, savedEngagement } =
        useContext(ActionContext);
    const { engagementFormData, updateEngagementSettings, settings } = useContext(EngagementTabsContext);
    const dispatch = useAppDispatch();

    const { visibility: savedVisibility } = engagementFormData;
    const [visibility, setVisibility] = useState(savedVisibility);
    const [sendReport, setSendReport] = useState(Boolean(settings.send_report));
    const [updatingSettings, setUpdatingSettings] = useState(false);

    const handleUpdateEngagementMetadata = () => {
        return handleUpdateEngagementMetadataRequest({
            ...engagementFormData,
            engagement_id: Number(engagementId),
        });
    };

    const handleUpdateEngagementSettings = () => {
        return handleUpdateEngagementRequest({
            ...engagementFormData,
            visibility: visibility,
        });
    };

    const handleUpdateSettings = () => {
        return updateEngagementSettings({
            send_report: sendReport,
        });
    };

    const handleSaveSettings = async () => {
        try {
            if (!savedEngagement.id) {
                dispatch(openNotification({ text: 'Must create engagement first', severity: 'error' }));
                return;
            }
            setUpdatingSettings(true);
            await handleUpdateEngagementMetadata();
            await handleUpdateEngagementSettings();
            await handleUpdateSettings();
            setUpdatingSettings(false);
            dispatch(openNotification({ text: 'Engagement settings saved', severity: 'success' }));
        } catch (error) {
            setUpdatingSettings(false);
            dispatch(openNotification({ text: 'Error saving engagement settings', severity: 'error' }));
        }
    };

    const hasBeenOpened = [SubmissionStatus.Closed, SubmissionStatus.Open].includes(
        savedEngagement.engagement_status.id,
    );

    return (
        <EngagementSettingsContext.Provider
            value={{
                handleSaveSettings,
                hasBeenOpened,
                sendReport,
                setSendReport,
                setVisibility,
                updatingSettings,
                visibility,
            }}
        >
            {children}
        </EngagementSettingsContext.Provider>
    );
};

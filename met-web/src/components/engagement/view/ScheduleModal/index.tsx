import React, { useContext, useState } from 'react';
import { Grid, Stack, TextField, Modal } from '@mui/material';
import { modalStyle, PrimaryButton, SecondaryButton, MetHeader1, MetBody, MetLabel } from 'components/common';
import { useAppDispatch } from 'hooks';
import { EngagementStatus } from 'constants/engagementStatus';
import { DesktopDatePicker } from '@mui/x-date-pickers/DesktopDatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ActionContext } from 'components/engagement/view/ActionContext';
import { openNotification } from 'services/notificationService/notificationSlice';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { TIMEZONES } from 'constants/timezones';

interface ScheduleModalProps {
    reschedule: boolean;
    open: boolean;
    updateModal: (open: boolean) => void;
}

// Helper function to create a Date object that displays Pacific time values in the pickers
const createPacificDisplayDate = (pacificDate?: Date) => {
    const sourceDate = pacificDate || new Date();

    // Get the Pacific time components
    const pacificTime = utcToZonedTime(sourceDate, TIMEZONES.CANADA_PACIFIC);

    // Create a new Date with these components but in local context for the pickers
    return new Date(
        pacificTime.getFullYear(),
        pacificTime.getMonth(),
        pacificTime.getDate(),
        pacificTime.getHours(),
        pacificTime.getMinutes(),
        pacificTime.getSeconds(),
    );
};

// Convert picker date to Pacific timezone for backend
const convertPickerDateToPacificUTC = (pickerDate: Date) => {
    // The picker date contains the Pacific time values but in local context
    // We need to treat these values as Pacific time and convert to UTC

    // Create a date string with the picker values
    const year = pickerDate.getFullYear();
    const month = pickerDate.getMonth();
    const day = pickerDate.getDate();
    const hours = pickerDate.getHours();
    const minutes = pickerDate.getMinutes();
    const seconds = pickerDate.getSeconds();

    // Create a date with these values (this will be in local timezone context)
    const localDate = new Date(year, month, day, hours, minutes, seconds);

    // Convert this to UTC assuming it represents Pacific time
    const pacificUTC = zonedTimeToUtc(localDate, TIMEZONES.CANADA_PACIFIC);

    return pacificUTC;
};

const ScheduleModal = ({ reschedule, open, updateModal }: ScheduleModalProps) => {
    // Initialize with current Pacific time
    const [scheduledDate, setScheduledDate] = useState<Date>(() => {
        return createPacificDisplayDate();
    });

    const { savedEngagement, scheduleEngagement } = useContext(ActionContext);
    const dispatch = useAppDispatch();

    const isEngagementReady = () => {
        return (
            savedEngagement.surveys.length === 1 &&
            savedEngagement.content &&
            savedEngagement.description &&
            savedEngagement.banner_url
        );
    };

    const handleChange = (newDate: Date | null) => {
        if (newDate != null) {
            setScheduledDate(newDate);
        }
    };

    const validateDate = () => {
        const endDate = new Date(savedEngagement.end_date);
        const pacificUTC = convertPickerDateToPacificUTC(scheduledDate);

        if (pacificUTC && pacificUTC >= endDate) {
            dispatch(
                openNotification({
                    severity: 'error',
                    text: 'Please make the scheduled date before the engagement end date',
                }),
            );
            return false;
        } else {
            return true;
        }
    };

    const handleSchedule = async () => {
        if (!isEngagementReady()) {
            dispatch(
                openNotification({
                    severity: 'error',
                    text: 'Please complete engagement before scheduling it',
                }),
            );
            return;
        }
        if (validateDate()) {
            // Convert picker selection to proper Pacific UTC
            const pacificUTC = convertPickerDateToPacificUTC(scheduledDate);

            await scheduleEngagement({
                id: savedEngagement.id,
                scheduled_date: pacificUTC.toISOString(),
                status_id: EngagementStatus.Scheduled,
            });

            updateModal(false);
        }
    };

    return (
        <Modal aria-labelledby="modal-title" open={open} onClose={() => updateModal(false)}>
            <Grid
                data-testid={'schedule-modal'}
                container
                direction="row"
                justifyContent="flex-start"
                alignItems="space-between"
                sx={{ ...modalStyle }}
                rowSpacing={2}
            >
                <Grid container direction="row" item xs={12}>
                    <Grid item xs={12}>
                        <MetHeader1 bold sx={{ mb: 2 }}>
                            {reschedule ? 'Reschedule Engagement' : 'Schedule Engagement'}
                        </MetHeader1>
                    </Grid>
                </Grid>
                <Grid container direction="row" item xs={12}>
                    <Grid item xs={12}>
                        <MetBody sx={{ mb: 1 }}>
                            The Engagement page will be visible on the date selected below but the public won’t be able
                            to provide feedback until the public comment period opens.
                        </MetBody>
                    </Grid>
                    <Grid item xs={12}>
                        <MetBody sx={{ mb: 1, fontWeight: 'bold' }}>
                            Enter the date & time you want the Engagement page to go live.
                        </MetBody>
                    </Grid>
                    <Grid
                        item
                        container
                        direction={{ xs: 'column', sm: 'row' }}
                        xs={12}
                        justifyContent="flex-start"
                        spacing={1}
                        sx={{ mt: '1em' }}
                    >
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <Grid data-testid={'desktop-datepicker'} item xs={6}>
                                <MetLabel>Date</MetLabel>
                                <DesktopDatePicker
                                    inputFormat="MM/DD/YYYY"
                                    value={scheduledDate}
                                    onChange={handleChange}
                                    renderInput={(params) => <TextField {...params} />}
                                />
                            </Grid>
                            <Grid data-testid={'time-picker'} item xs={6}>
                                <MetLabel>Time (PT)</MetLabel>
                                <TimePicker
                                    value={scheduledDate}
                                    onChange={handleChange}
                                    renderInput={(params) => <TextField {...params} />}
                                />
                            </Grid>
                        </LocalizationProvider>
                    </Grid>

                    <Grid
                        item
                        container
                        xs={12}
                        direction="row"
                        justifyContent="flex-end"
                        spacing={1}
                        sx={{ mt: '1em' }}
                    >
                        <Stack
                            direction={{ md: 'column-reverse', lg: 'row' }}
                            spacing={1}
                            width="100%"
                            justifyContent="flex-end"
                        >
                            <SecondaryButton data-testid={'cancel-button'} onClick={() => updateModal(false)}>
                                Cancel
                            </SecondaryButton>
                            <PrimaryButton
                                data-testid={'schedule-button'}
                                onClick={handleSchedule}
                                type="submit"
                                variant={'contained'}
                            >
                                Submit
                            </PrimaryButton>
                        </Stack>
                    </Grid>
                </Grid>
            </Grid>
        </Modal>
    );
};

export default ScheduleModal;

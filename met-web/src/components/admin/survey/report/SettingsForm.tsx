import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Stack } from '@mui/material';
import {
    MetHeader3,
    MetHeader4,
    MetLabel,
    MetPageGridContainer,
    MetPaper,
    PrimaryButton,
    SecondaryButton,
} from 'components/shared/common';
import { ReportSettingsContext } from './ReportSettingsContext';
import SettingsTable from './SettingsTable';
import SearchBar from './SearchBar';

const SettingsForm = () => {
    const { setSavingSettings, savingSettings, survey } = useContext(ReportSettingsContext);

    const navigate = useNavigate();

    return (
        <MetPageGridContainer container spacing={1}>
            <Grid item xs={12}>
                <MetHeader3 bold>Report Settings</MetHeader3>
            </Grid>
            <Grid item xs={12}>
                <MetPaper
                    sx={{
                        padding: '3rem',
                    }}
                >
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <MetLabel>Search Questions</MetLabel>
                        </Grid>
                        <Grid item xs={6}>
                            <SearchBar />
                        </Grid>
                        <Grid item xs={12}>
                            <MetHeader4>Select the Questions You Would Like to Display on the Public Report</MetHeader4>
                            <SettingsTable />
                        </Grid>
                        <Grid item xs={12}>
                            <Stack direction="row" spacing={2}>
                                <PrimaryButton
                                    data-testid={'survey/report/save-button'}
                                    onClick={() => setSavingSettings(true)}
                                    loading={savingSettings}
                                >
                                    Save
                                </PrimaryButton>
                                <SecondaryButton onClick={() => navigate(`/surveys/${survey?.id}/build`)}>
                                    Back
                                </SecondaryButton>
                            </Stack>
                        </Grid>
                    </Grid>
                </MetPaper>
            </Grid>
        </MetPageGridContainer>
    );
};

export default SettingsForm;

import React, { useContext } from 'react';
import { Grid, FormControlLabel, RadioGroup, Radio, Box } from '@mui/material';
import { MetHeader4, MetDescription, MetLabel } from '../../../../common';
import { INTERNAL_EMAIL_DOMAIN } from 'constants/emailVerification';
import { EngagementSettingsContext } from './EngagementSettingsContext';
import { EngagementVisibility } from 'constants/engagementVisibility';

const EngagementAccessAndVisibility = () => {
    const { visibility, setVisibility } = useContext(EngagementSettingsContext);
    const { hasBeenOpened } = useContext(EngagementSettingsContext);

    const handleChangeVisibility = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log('event: ', e);
        setVisibility(parseInt(e.target.value));
    };

    return (
        <Grid container direction="row" justifyContent="flex-start" alignItems="flex-start" spacing={1}>
            <Grid item xs={12}>
                <MetHeader4 bold>Engagement Access & Visibility</MetHeader4>
            </Grid>
            <Grid item xs={12}>
                <RadioGroup
                    aria-labelledby="demo-radio-buttons-group-label"
                    defaultValue={visibility}
                    name="radio-buttons-group"
                    onChange={handleChangeVisibility}
                    value={visibility}
                >
                    <FormControlLabel
                        value={EngagementVisibility.Public}
                        control={<Radio />}
                        disabled={hasBeenOpened}
                        label={
                            <Box paddingTop="10px">
                                <MetLabel>Public Engagement</MetLabel>
                                <MetDescription>
                                    This is the default mode. This engagement will be displayed on the homepage, be
                                    searchable and accessible to everyone
                                </MetDescription>
                            </Box>
                        }
                        sx={{
                            alignItems: 'start',
                        }}
                    />

                    <FormControlLabel
                        value={EngagementVisibility.Hidden}
                        control={<Radio />}
                        disabled={hasBeenOpened}
                        label={
                            <Box paddingTop="10px">
                                <MetLabel>Hidden Engagement</MetLabel>
                                <MetDescription>
                                    This engagement will not show up on the homepage or search within EPIC.engage. The
                                    engagement will only be accessible to external users with a link to the engagement.
                                    NOTE: The engagement may still be searchable within Google and other search engines,
                                    and should not contain confidential information.
                                </MetDescription>
                            </Box>
                        }
                        sx={{
                            alignItems: 'start',
                        }}
                    />
                    <FormControlLabel
                        value={EngagementVisibility.Internal}
                        control={<Radio />}
                        disabled={hasBeenOpened}
                        label={
                            <Box paddingTop="10px" fontWeight="700px">
                                <MetLabel>Internal Engagement</MetLabel>
                                <MetDescription>
                                    This engagement is only available to people requesting access from a{' '}
                                    {INTERNAL_EMAIL_DOMAIN} email address. This engagement will not show up on the
                                    homepage or search within EPIC.engage.
                                </MetDescription>
                            </Box>
                        }
                        sx={{
                            alignItems: 'start',
                        }}
                    />
                </RadioGroup>
            </Grid>
        </Grid>
    );
};

export default EngagementAccessAndVisibility;

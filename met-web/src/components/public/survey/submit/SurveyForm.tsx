import React, { useContext, useRef } from 'react';
import { Skeleton, Grid, Stack } from '@mui/material';
import { SubmitSurveyContext } from './SubmitSurveyContext';
import FormSubmit from 'components/shared/form/FormBuilder/FormSubmit';
import { FormSubmitHandle } from 'components/shared/form/FormBuilder/types';
import { useAppSelector } from 'hooks';
import { PrimaryButton, SecondaryButton } from 'components/shared/common';
import { SurveyFormProps } from 'components/admin/survey/types';
import { When } from 'react-if';

export const SurveyForm = ({ handleClose }: SurveyFormProps) => {
    const isLoggedIn = useAppSelector((state) => state.user.authentication.authenticated);
    const { isSurveyLoading, savedSurvey, handleSubmit, isSubmitting, savedEngagement } = useContext(SubmitSurveyContext);
    const formRef = useRef<FormSubmitHandle>(null);

    if (isSurveyLoading) {
        return <Skeleton variant="rectangular" height="50em" width="100%" />;
    }

    const handleFormSubmitClick = async () => {
        // Trigger FormIO validation and submit
        const result = await formRef.current?.triggerSubmit();
    };

    return (
        <Grid
            container
            direction="row"
            justifyContent="flex-start"
            alignItems="flex-start"
            spacing={1}
            padding={'2em 2em 1em 2em'}
        >
            <Grid item xs={12}>
                <FormSubmit
                    ref={formRef}
                    savedForm={savedSurvey.form_json}
                    handleFormChange={() => {}}
                    handleFormSubmit={handleSubmit}
                    surveyId={savedSurvey.id?.toString()}
                    surveyName={savedSurvey.name}
                    engagementId={savedSurvey.engagement_id?.toString()}
                    engagementName={savedEngagement?.name}
                />
            </Grid>
            <When condition={savedSurvey.form_json?.display === 'form'}>
                <Grid item container xs={12} direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: '1em' }}>
                    <Stack
                        direction={{ md: 'column-reverse', lg: 'row' }}
                        spacing={1}
                        width="100%"
                        justifyContent="flex-end"
                    >
                        <SecondaryButton onClick={() => handleClose()}>Cancel</SecondaryButton>
                        <PrimaryButton
                            disabled={isLoggedIn || isSubmitting}
                            onClick={handleFormSubmitClick}
                            loading={isSubmitting}
                        >
                            Submit
                        </PrimaryButton>
                    </Stack>
                </Grid>
            </When>
        </Grid>
    );
};

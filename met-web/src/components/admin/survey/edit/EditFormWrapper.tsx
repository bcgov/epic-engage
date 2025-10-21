import React, { useContext } from 'react';
import { Grid, Skeleton } from '@mui/material';
import { Banner } from 'components/shared/banner/Banner';
import { EditForm } from './EditForm';
import { EditSurveyContext } from './EditSurveyContext';
import { MetPaper } from 'components/shared/common';
import { InvalidTokenModal } from './InvalidTokenModal';
import { useNavigate, useParams } from 'react-router';
import { When } from 'react-if';
import EngagementInfoSection from 'components/public/engagement/view/EngagementInfoSection';

const EditFormWrapper = () => {
    const { slug } = useParams();
    const { isTokenValid, isLoading, savedEngagement, submission } = useContext(EditSurveyContext);
    const navigate = useNavigate();
    const engagementPath = slug ? `/${slug}` : `/engagements/${savedEngagement?.id}/view`;

    if (isLoading || !savedEngagement) {
        return <Skeleton variant="rectangular" width="100%" height="38em" />;
    }

    return (
        <Grid container direction="row" justifyContent="flex-start" alignItems="flex-start">
            <Grid item xs={12}>
                <Banner imageUrl={savedEngagement.banner_url}>
                    <EngagementInfoSection savedEngagement={savedEngagement} />
                </Banner>
            </Grid>
            <Grid
                container
                item
                xs={12}
                direction="row"
                justifyContent={'flex-start'}
                alignItems="flex-start"
                m={{ lg: '0 8em 1em 3em', md: '2em', xs: '1em' }}
            >
                <When condition={isTokenValid && !!submission}>
                    <Grid item xs={12}>
                        <MetPaper elevation={2}>
                            <EditForm
                                handleClose={() => {
                                    navigate(engagementPath);
                                }}
                            />
                        </MetPaper>
                    </Grid>
                </When>
                <InvalidTokenModal
                    open={!isTokenValid}
                    handleClose={() => {
                        navigate(engagementPath);
                    }}
                />
            </Grid>
        </Grid>
    );
};

export default EditFormWrapper;

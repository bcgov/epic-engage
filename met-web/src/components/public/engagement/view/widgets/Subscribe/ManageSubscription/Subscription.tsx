import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Grid } from '@mui/material';
import { MetHeader1, MetParagraph, MetLabel } from 'components/shared/common';
import { Banner } from 'components/shared/banner/Banner';
import LandingPageBanner from 'assets/images/LandingPageBanner.png';
import { useAppDispatch, useAppTranslation } from 'hooks';
import { openNotification } from 'services/notificationService/notificationSlice';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { SubscriptionType } from './subscribe';
import { verifyEmailVerification } from 'services/emailVerificationService';
import { confirmSubscription, unSubscribe, unSubscribeByToken } from 'services/subscriptionService';
import { Palette } from 'styles/Theme';
import { SubscriptionType as SubscriptionScope } from 'constants/subscriptionType';

const UNSUBSCRIBED_SCOPE_TEXT: Record<SubscriptionScope, string> = {
    [SubscriptionScope.ENGAGEMENT]: 'You will no longer receive communications for this engagement.',
    [SubscriptionScope.PROJECT]: 'You will no longer receive communications for this project.',
    [SubscriptionScope.TENANT]: 'You will no longer receive updates about new engagements.',
};

export type SubscriptionParams = {
    engagementId?: string;
    subscriptionStatus?: string;
    scriptionKey?: string;
    token?: string;
};

export const Subscription = () => {
    const { engagementId, subscriptionStatus, scriptionKey, token } = useParams<SubscriptionParams>();
    const [subscriptionText, setSubscriptionText] = useState<string[]>([]);

    const dispatch = useAppDispatch();
    const { t: translate } = useAppTranslation();

    useEffect(() => {
        verifySubscribeKey();
    }, [scriptionKey, token]);

    const verifySubscribeKey = async () => {
        try {
            // Handle new token-based unsubscribe route
            if (token) {
                const { subscription_type } = await unSubscribeByToken(token, false);
                setSubscriptionText([
                    'We are sorry to see you go.',
                    '',
                    'We wanted to confirm that you have been successfully unsubscribed.',
                    UNSUBSCRIBED_SCOPE_TEXT[subscription_type] ?? UNSUBSCRIBED_SCOPE_TEXT[SubscriptionScope.ENGAGEMENT],
                    '',
                    'Thank you.',
                ]);
                return;
            }

            if (!scriptionKey) {
                return;
            }
            if (subscriptionStatus == SubscriptionType.SUBSCRIBE) {
                const subscribeToken = scriptionKey;
                const subscribed_email = await verifyEmailVerification(subscribeToken);
                const subscribed = JSON.stringify(subscribed_email);
                await confirmSubscription({
                    engagement_id: parseInt(engagementId ?? ''),
                    participant_id: JSON.parse(subscribed).participant_id,
                    is_subscribed: true,
                });
                setSubscriptionText(['You have successfully confirmed your subscription. Thank you.']);
            }
            if (subscriptionStatus == SubscriptionType.UNSUBSCRIBE) {
                // Legacy unsubscribe flow - kept for backwards compatibility
                // New emails will use the token-based route
                const participant_id = scriptionKey;
                await unSubscribe({
                    participant_id: parseInt(participant_id ?? ''),
                    is_subscribed: false,
                });
                setSubscriptionText([
                    'We are sorry to see you go.',
                    '',
                    'We wanted to confirm that you have been successfully unsubscribed from all of our emails.',
                    'You will no longer receive any communications from us.',
                    '',
                    'Thank you.',
                ]);
            }
        } catch {
            dispatch(openNotification({ severity: 'error', text: 'Error processing subscription request' }));
        }
    };

    return (
        <Grid container direction="row" justifyContent={'center'} alignItems="center">
            <Grid item xs={12}>
                <Banner height={'330px'} imageUrl={LandingPageBanner}>
                    <Grid
                        container
                        direction="row"
                        justifyContent="flex-start"
                        alignItems="flex-start"
                        height="100%"
                        sx={{
                            position: 'absolute',
                            top: '0px',
                            left: '0px',
                        }}
                    >
                        <Grid
                            item
                            lg={6}
                            sm={12}
                            container
                            direction="row"
                            justifyContent="flex-start"
                            alignItems="flex-start"
                            sx={{
                                backgroundColor: 'rgba(242, 242, 242, 0.95)',
                                padding: '1em',
                                margin: '1em',
                                maxWidth: '90%',
                            }}
                            m={{ lg: '3em 5em 0 3em', md: '3em', sm: '1em' }}
                            rowSpacing={2}
                        >
                            <Grid item xs={12}>
                                <MetHeader1>{translate('landing.banner.header')}</MetHeader1>
                            </Grid>
                            <Grid item xs={12}>
                                <MetParagraph>{translate('landing.banner.description')}</MetParagraph>
                            </Grid>
                        </Grid>
                    </Grid>
                </Banner>
            </Grid>
            <Grid
                item
                lg={12}
                sm={12}
                container
                direction="row"
                justifyContent="flex-start"
                alignItems="flex-start"
                sx={{
                    padding: '1em',
                    maxWidth: '100%',
                }}
                m={{ lg: '3em 5em 0 3em', md: '3em', sm: '1em' }}
                rowSpacing={2}
            >
                {subscriptionText.length > 0 && (
                    <CheckCircleRoundedIcon style={{ color: Palette.success.main, fontSize: 50 }} />
                )}
                <MetLabel m={{ lg: '.5em 0 0 .5em', md: '3em', sm: '1em' }}>
                    {subscriptionText.map((text, index) => (
                        <React.Fragment key={index}>
                            {text}
                            <br />
                        </React.Fragment>
                    ))}
                </MetLabel>
            </Grid>
        </Grid>
    );
};

export default Subscription;

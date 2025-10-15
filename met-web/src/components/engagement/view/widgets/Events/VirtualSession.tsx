import React from 'react';
import { Grid, Link } from '@mui/material';
import { MetBody } from 'components/common';
import { formatDate } from 'components/common/dateHelper';
import { EventProps } from './InPersonEvent';
import { TIMEZONE_OPTIONS } from 'constants/timezones';

const VirtualSession = ({ eventItem }: EventProps) => {
    const justifyContent = { xs: 'center', md: 'flex-start' };
    return (
        <>
            <Grid container justifyContent={justifyContent} paddingBottom={0.5} item xs={12}>
                <MetBody>{eventItem.description}</MetBody>
            </Grid>
            <Grid item container justifyContent={justifyContent} xs={12}>
                <Grid item xs={3} marginRight={2}>
                    <MetBody bold>Date:&nbsp;</MetBody>
                </Grid>
                <Grid item xs={8} paddingLeft={2}>
                    <MetBody>{formatDate(eventItem.start_date, 'MMMM DD, YYYY')}</MetBody>
                </Grid>
            </Grid>
            <Grid container justifyContent={justifyContent} item xs={12}>
                <Grid item xs={3} marginRight={2}>
                    <MetBody bold>Time:&nbsp;</MetBody>
                </Grid>
                <Grid item xs={8} paddingLeft={2}>
                    <MetBody>
                        {`${new Date(eventItem.start_date).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                        })} to ${new Date(eventItem.end_date).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                        })} ${
                            TIMEZONE_OPTIONS.find((tz: { value: string }) => tz.value === eventItem.timezone)?.label ||
                            ''
                        }`}
                    </MetBody>
                </Grid>
            </Grid>
            <Grid container justifyContent={justifyContent} item xs={12} sx={{ whiteSpace: 'pre-line' }}>
                <Link target="_blank" href={`${eventItem.url}`}>
                    {eventItem.url_label}
                </Link>
            </Grid>
        </>
    );
};

export default VirtualSession;

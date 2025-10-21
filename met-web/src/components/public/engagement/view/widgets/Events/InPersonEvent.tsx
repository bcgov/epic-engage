import React from 'react';
import { EventItem } from 'models/event';
import { Grid } from '@mui/material';
import { MetBody } from 'components/shared/common';
import { formatDate } from 'utils/helpers/dateHelper';
import { TIMEZONE_OPTIONS } from 'constants/timezones';
import { getDateInTimezone } from 'components/admin/engagement/form/EngagementWidgets/Events/utils';

export interface EventProps {
    eventItem: EventItem;
}

const InPersonEvent = ({ eventItem }: EventProps) => {
    const justifyContent = { xs: 'center', md: 'flex-start' };

    return (
        <>
            <Grid container justifyContent={justifyContent} paddingBottom={0.5} item xs={12}>
                <MetBody>{eventItem.description}</MetBody>
            </Grid>
            <Grid container justifyContent={justifyContent} item xs={12}>
                <Grid item xs={3} marginRight={2}>
                    <MetBody bold>Location:&nbsp;</MetBody>
                </Grid>
                <Grid item xs={8} paddingLeft={2}>
                    <MetBody>{eventItem.location_name}</MetBody>
                </Grid>
            </Grid>
            <Grid container justifyContent={justifyContent} item xs={12}>
                <Grid item xs={3} marginRight={2}>
                    <MetBody bold>Address:&nbsp;</MetBody>
                </Grid>
                <Grid item xs={8} paddingLeft={2}>
                    <MetBody>{eventItem.location_address}</MetBody>
                </Grid>
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
                        {`${getDateInTimezone(new Date(eventItem.start_date), eventItem.timezone).toLocaleTimeString(
                            'en-US',
                            {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                            },
                        )} to ${getDateInTimezone(new Date(eventItem.end_date), eventItem.timezone).toLocaleTimeString(
                            'en-US',
                            {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                            },
                        )} ${
                            TIMEZONE_OPTIONS.find((tz: { value: string }) => tz.value === eventItem.timezone)?.label ||
                            ''
                        }`}
                    </MetBody>
                </Grid>
            </Grid>
        </>
    );
};

export default InPersonEvent;

import { Grid } from '@mui/material';
import React, { Component } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default class TooltipContent extends Component<any> {
    static displayName = 'TooltipContent';

    static defaultProps = {};

    render() {
        const { label, active, payload } = this.props;

        return active && payload && payload.length ? (
            <Grid container sx={{ backgroundColor: 'white', padding: 1, minWidth: 100 }}>
                <Grid item xs={2} sm={4} md={6} lg={8} xl={10}>
                    {label || payload[0]?.name}
                </Grid>
                <Grid item xs={2} sm={4} md={6} lg={8} xl={10}>
                    Count: {payload[0]?.value}
                </Grid>
            </Grid>
        ) : null;
    }
}

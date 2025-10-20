import React from 'react';
import { Grid, CircularProgress, Typography, Box, CircularProgressProps } from '@mui/material';

export const MidScreenLoader = () => (
    <Grid container direction="row" justifyContent="center" alignItems="center" sx={{ minHeight: '90vh' }}>
        <Grid item>
            <CircularProgress data-testid="loader" />
        </Grid>
    </Grid>
);

export const CircularProgressWithLabel = (props: CircularProgressProps & { value: number }) => {
    return (
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress color="inherit" {...props} />
            <Box
                sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Typography variant="caption" component="div" color="inherit">{`${Math.round(
                    props.value,
                )}%`}</Typography>
            </Box>
        </Box>
    );
};

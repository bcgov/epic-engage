import React from 'react';
import { Grid, Paper as MuiPaper, CircularProgress, Typography, Stack, IconButton, Toolbar, Box } from '@mui/material';
import { styled } from '@mui/system';
import EditIcon from '@mui/icons-material/Edit';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { Palette } from 'styles/Theme';
import { When } from 'react-if';
import { MetHeader3 } from './Headers';

export const MobileToolbar = styled(Toolbar)(() => ({
    marginBottom: '40px',
}));

const StyledPaper = styled(MuiPaper)(() => ({
    border: '1px solid #cdcdcd',
    borderRadius: '5px',
    boxShadow: 'rgb(0 0 0 / 6%) 0px 2px 2px -1px, rgb(0 0 0 / 6%) 0px 1px 1px 0px, rgb(0 0 0 / 6%) 0px 1px 3px 0px',
}));

export const MetPaper = ({ children, ...rest }: { children: React.ReactNode; [prop: string]: unknown }) => {
    return (
        <StyledPaper elevation={0} {...rest}>
            {children}
        </StyledPaper>
    );
};

export const MetWidgetPaper = styled(MuiPaper)(() => ({
    backgroundColor: '#F2F2F2',
    padding: '1em',
}));

interface MetSurveyProps {
    testId?: number;
    title: string;
    children?: React.ReactNode;
    [prop: string]: unknown;
    onEditClick?: () => void;
    onDeleteClick?: () => void;
    deleting?: boolean;
}

export const MetSurvey = ({
    testId,
    children,
    title,
    onEditClick,
    onDeleteClick,
    deleting,
    ...rest
}: MetSurveyProps) => {
    return (
        <MetWidgetPaper elevation={3} {...rest}>
            <Grid container direction="row" alignItems={'flex-start'} justifyContent="flex-start">
                <Grid item xs={6}>
                    <MetHeader3 bold>{title}</MetHeader3>
                </Grid>
                <Grid item xs={6} container direction="row" justifyContent="flex-end">
                    <Stack direction="row" spacing={1}>
                        <When condition={!!onEditClick}>
                            <IconButton color="inherit" onClick={onEditClick} data-testid="survey-widget/edit">
                                <EditIcon />
                            </IconButton>
                        </When>
                        <When condition={!!onDeleteClick}>
                            <IconButton
                                color="inherit"
                                onClick={onDeleteClick}
                                data-testid={`survey-widget/remove-${testId}`}
                            >
                                {deleting ? <CircularProgress size="1em" color="inherit" /> : <HighlightOffIcon />}
                            </IconButton>
                        </When>
                    </Stack>
                </Grid>
                <Grid item xs={12}>
                    {children}
                </Grid>
            </Grid>
        </MetWidgetPaper>
    );
};

export const MetPageGridContainer = styled(Grid)(() => ({
    padding: '3em',
}));

interface RepeatedGridProps {
    times: number;
    children: React.ReactNode;
    [prop: string]: unknown;
}

export const RepeatedGrid = ({ times = 1, children, ...rest }: RepeatedGridProps) => {
    return (
        <>
            {[...Array(times)].map((_element, index) => (
                <Grid key={`repeated-grid-${index}`} {...rest}>
                    {children}
                </Grid>
            ))}
        </>
    );
};

export const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '48%',
    transform: 'translate(-50%, -50%)',
    maxWidth: 'min(95vw, 700px)',
    maxHeight: '95vh',
    bgcolor: 'background.paper',
    boxShadow: 10,
    pt: 2,
    px: 4,
    pb: 3,
    m: 1,
    overflowY: 'scroll',
    color: Palette.text.primary,
};

export const MetDisclaimer = ({
    children,
    marginTop = '2em',
}: {
    children: React.ReactNode;
    marginTop?: number | string;
}) => {
    return (
        <Box
            sx={{
                borderLeft: 8,
                borderColor: '#003366',
                backgroundColor: '#F2F2F2',
            }}
        >
            <Typography
                sx={{
                    p: '1em',
                    mt: marginTop,
                    fontSize: '0.8rem',
                }}
            >
                {children}
            </Typography>
        </Box>
    );
};

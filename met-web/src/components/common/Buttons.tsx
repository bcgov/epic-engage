import React from 'react';
import { Button as MuiButton, CircularProgress, IconButton, ToggleButton } from '@mui/material';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { styled } from '@mui/system';
import { Palette } from 'styles/Theme';
import LoadingButton from '@mui/lab/LoadingButton';

export const MetTooltip = styled(({ className, ...props }: TooltipProps) => (
    <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
        backgroundColor: theme.palette.primary?.main,
        fontSize: 11,
    },
    [`& .${tooltipClasses.arrow}`]: {
        color: theme.palette.primary?.main,
    },
}));

const StyledPrimaryButton = styled(LoadingButton)(() => ({
    backgroundColor: Palette.primary.main,
    color: '#fff',
    lineHeight: '1.1rem',
    '&:hover': {
        opacity: '0.8',
        backgroundColor: Palette.primary.main,
        color: '#fff',
        textDecoration: 'underline',
    },
}));

const StyledSecondaryButton = styled(LoadingButton)(() => ({
    backgroundColor: 'transparent',
    color: Palette.primary.main,
    lineHeight: '1.1rem',
    border: `2px solid ${Palette.primary.main}`,
    '&:hover': {
        opacity: '0.8',
        textDecoration: 'underline',
        backgroundColor: Palette.primary.main,
        color: '#FFFFFF',
        border: `2px solid ${Palette.primary.main}`,
    },
}));

const StyledWidgetButton = styled(MuiButton)(() => ({
    backgroundColor: 'transparent',
    color: '#494949',
    lineHeight: '1.1rem',
    border: `2px solid ${'#707070'}`,
    '&:hover': {
        opacity: '0.8',
        textDecoration: 'underline',
        backgroundColor: '#f2f2f2',
        color: '#494949',
        border: `2px solid ${'#f2f2f2'}`,
    },
}));

const StyledSocialIconButton = styled(IconButton)(() => ({
    border: '1px solid #494949',
    color: '#494949',
}));

const StyledToggleButton = styled(ToggleButton)(({ theme }) => ({
    backgroundColor: 'transparent',
    color: Palette.primary.main,
    lineHeight: '1.1rem',
    border: `2px solid ${Palette.primary.main}`,
    '&.Mui-selected': {
        backgroundColor: Palette.primary.main,
        color: '#fff',
        '&:hover': {
            backgroundColor: Palette.primary.main,
        },
    },
    '&:hover': {
        opacity: '0.8',
        textDecoration: 'underline',
        backgroundColor: Palette.primary.main,
        color: '#FFFFFF',
        '&.Mui-selected:hover': {
            textDecoration: 'underline',
        },
    },
}));

export const SocialIconButton = ({ children, ...rest }: { children: React.ReactNode; [prop: string]: unknown }) => (
    <StyledSocialIconButton color="info" {...rest}>
        {children}
    </StyledSocialIconButton>
);

export const WidgetButton = ({ children, ...rest }: { children: React.ReactNode; [prop: string]: unknown }) => (
    <StyledWidgetButton {...rest} variant="outlined">
        {children}
    </StyledWidgetButton>
);

export const SecondaryButton = ({
    children,
    disabled = false,
    ...rest
}: {
    children: React.ReactNode;
    [prop: string]: unknown;
}) => {
    if (disabled) {
        return (
            <PrimaryButton {...rest} disabled>
                {children}
            </PrimaryButton>
        );
    }
    return (
        <StyledSecondaryButton
            {...rest}
            variant="outlined"
            loadingIndicator={<CircularProgress color="primary" size={'1.8em'} />}
        >
            {children}
        </StyledSecondaryButton>
    );
};

export const PrimaryButton = ({ children, ...rest }: { children: React.ReactNode; [prop: string]: unknown }) => (
    <StyledPrimaryButton
        {...rest}
        variant="contained"
        loadingIndicator={<CircularProgress color="primary" size={'1.8em'} />}
    >
        {children}
    </StyledPrimaryButton>
);

interface MetToggleButtonProps {
    children: React.ReactNode;
    value: string;
    [prop: string]: unknown;
}

export const MetToggleButton = ({ value, children, ...rest }: MetToggleButtonProps) => (
    <StyledToggleButton {...rest} value={value}>
        {children}
    </StyledToggleButton>
);

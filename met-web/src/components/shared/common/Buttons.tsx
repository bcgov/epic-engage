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
    backgroundColor: Palette.button.primary.backgroundColor,
    color: Palette.button.primary.color,
    lineHeight: '1.1rem',
    '&:hover': {
        opacity: '0.8',
        backgroundColor: Palette.button.primary.hoverBackgroundColor,
        color: Palette.button.primary.color,
        textDecoration: 'none',
    },
    '&.Mui-disabled': {
        backgroundColor: Palette.button.primary.disabledBackgroundColor,
        color: Palette.button.primary.disabledColor,
    },
}));

const StyledSecondaryButton = styled(LoadingButton)(() => ({
    backgroundColor: Palette.button.secondary.backgroundColor,
    color: Palette.button.secondary.color,
    lineHeight: '1.1rem',
    border: `2px solid ${Palette.button.secondary.color}`,
    '&:hover': {
        opacity: '0.8',
        textDecoration: 'none',
        backgroundColor: Palette.button.secondary.hoverBackgroundColor,
        color: Palette.button.secondary.color,
        border: `2px solid ${Palette.button.secondary.color}`,
    },
    // Keeps a disabled secondary button looking secondary rather than swapping it for a primary one.
    '&.Mui-disabled': {
        backgroundColor: Palette.button.secondary.disabledBackgroundColor,
        color: Palette.button.secondary.disabledColor,
        border: `2px solid ${Palette.border.default}`,
    },
}));

const StyledTertiaryButton = styled(LoadingButton)(() => ({
    backgroundColor: Palette.button.tertiary.backgroundColor,
    color: Palette.button.tertiary.color,
    lineHeight: '1.1rem',
    border: 'none',
    '&:hover': {
        opacity: '0.8',
        textDecoration: 'none',
        backgroundColor: Palette.button.tertiary.hoverBackgroundColor,
        color: Palette.button.tertiary.color,
        border: 'none',
    },
    '&.Mui-disabled': {
        backgroundColor: Palette.button.tertiary.disabledBackgroundColor,
        color: Palette.button.tertiary.disabledColor,
        border: 'none',
    },
}));

const StyledWidgetButton = styled(MuiButton)(() => ({
    backgroundColor: 'transparent',
    color: Palette.text.primary,
    lineHeight: '1.1rem',
    border: `2px solid ${Palette.border.medium}`,
    '&:hover': {
        opacity: '0.8',
        textDecoration: 'underline',
        backgroundColor: Palette.background.light,
        color: Palette.text.primary,
        border: `2px solid ${Palette.background.light}`,
    },
    '&.Mui-disabled': {
        color: Palette.text.disabled,
        border: `2px solid ${Palette.border.default}`,
    },
}));

const StyledSocialIconButton = styled(IconButton)(() => ({
    border: `1px solid ${Palette.text.primary}`,
    color: Palette.text.primary,
}));

const StyledToggleButton = styled(ToggleButton)(({ theme }) => ({
    backgroundColor: 'transparent',
    color: Palette.primary.main,
    lineHeight: '1.1rem',
    border: `2px solid ${Palette.primary.main}`,
    '&.Mui-selected': {
        backgroundColor: Palette.primary.main,
        color: Palette.text.invert,
        '&:hover': {
            backgroundColor: Palette.primary.main,
        },
    },
    '&:hover': {
        opacity: '0.8',
        textDecoration: 'underline',
        backgroundColor: Palette.primary.main,
        color: Palette.text.invert,
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
    disabled?: boolean;
    [prop: string]: unknown;
}) => {
    return (
        <StyledSecondaryButton
            {...rest}
            disabled={disabled}
            variant="outlined"
            loadingIndicator={<CircularProgress color="primary" size={'1.8em'} />}
        >
            {children}
        </StyledSecondaryButton>
    );
};

export const TertiaryButton = ({
    children,
    disabled = false,
    ...rest
}: {
    children: React.ReactNode;
    disabled?: boolean;
    [prop: string]: unknown;
}) => {
    return (
        <StyledTertiaryButton
            {...rest}
            disabled={disabled}
            variant="outlined"
            loadingIndicator={<CircularProgress color="primary" size={'1.8em'} />}
        >
            {children}
        </StyledTertiaryButton>
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

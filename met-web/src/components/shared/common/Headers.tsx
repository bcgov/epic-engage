import React from 'react';
import { Typography } from '@mui/material';
import { SxProps } from '@mui/system';
// styled from material/styles (not system) so the callback's `theme` is the typed MUI theme.
import { styled } from '@mui/material/styles';
import { MET_Header_Font_Weight } from 'styles/constants';

interface HeaderProps {
    sx?: SxProps;
    color?: string;
    bold?: boolean;
    children?: React.ReactNode | string;
    [prop: string]: unknown;
}

/**
 * Size, weight, line height and font family all come from the theme's typography variants, which
 * are built from B.C. Design System tokens. These components pick a variant; they no longer restate
 * the values. Caller `sx` is spread last so it can actually override.
 */

export const MetLabel = styled(Typography)(({ theme }) => ({
    ...theme.typography.body1,
    fontWeight: MET_Header_Font_Weight,
}));

export const MetParagraph = styled(Typography)(({ theme }) => theme.typography.body1);

export const MetIconText = styled(Typography)(({ theme }) => ({
    ...theme.typography.caption,
    lineHeight: 1.2,
}));

export const MetDescription = styled(Typography)(({ theme }) => ({
    ...theme.typography.body2,
    color: theme.palette.text.secondary,
}));

export const HeaderTitle = styled(Typography)(({ theme }) => theme.typography.h2);

export const MetSmallText = ({ bold, children, sx, ...rest }: HeaderProps) => {
    return (
        <Typography variant="body2" sx={{ fontWeight: bold ? MET_Header_Font_Weight : undefined, ...sx }} {...rest}>
            {children}
        </Typography>
    );
};

export const MetHeader1 = ({ bold, children, sx, ...rest }: HeaderProps) => {
    return (
        <Typography variant="h1" sx={{ fontWeight: bold ? MET_Header_Font_Weight : undefined, ...sx }} {...rest}>
            {children}
        </Typography>
    );
};

export const MetHeader2 = ({ bold, children, sx, ...rest }: HeaderProps) => {
    return (
        <Typography variant="h2" sx={{ fontWeight: bold ? MET_Header_Font_Weight : undefined, ...sx }} {...rest}>
            {children}
        </Typography>
    );
};

export const MetHeader3 = ({ bold, children, sx, ...rest }: HeaderProps) => {
    return (
        <Typography variant="h3" sx={{ fontWeight: bold ? MET_Header_Font_Weight : undefined, ...sx }} {...rest}>
            {children}
        </Typography>
    );
};

export const MetHeader4 = ({ bold, color, children, sx, ...rest }: HeaderProps) => {
    return (
        <Typography
            color={color}
            variant="h4"
            sx={{ fontWeight: bold ? MET_Header_Font_Weight : undefined, ...sx }}
            {...rest}
        >
            {children}
        </Typography>
    );
};

export const MetBody = ({ bold, children, sx, ...rest }: HeaderProps) => {
    return (
        <Typography variant="body1" sx={{ fontWeight: bold ? MET_Header_Font_Weight : undefined, ...sx }} {...rest}>
            {children}
        </Typography>
    );
};

export const ModalSubtitle = ({
    children,
    ...rest
}: {
    children: JSX.Element[] | JSX.Element | string;
    [prop: string]: unknown;
}) => {
    return (
        <Typography variant={'subtitle1'} {...rest}>
            {children}
        </Typography>
    );
};

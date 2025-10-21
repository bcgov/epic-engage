import React from 'react';
import { Typography } from '@mui/material';
import { SxProps, styled } from '@mui/system';
import { MET_Header_Font_Family, MET_Font_Weight, MET_Header_Font_Weight } from 'styles/constants';

interface HeaderProps {
    sx?: SxProps;
    color?: string;
    bold?: boolean;
    children?: React.ReactNode | string;
    [prop: string]: unknown;
}

export const MetLabel = styled(Typography)(() => ({
    fontSize: '16px',
    fontWeight: 'bold',
    fontFamily: MET_Header_Font_Family,
}));

export const MetParagraph = styled(Typography)(() => ({
    fontSize: '16px',
    fontFamily: MET_Header_Font_Family,
}));

export const MetIconText = styled(Typography)(() => ({
    fontSize: '11px',
    fontFamily: MET_Header_Font_Family,
    lineHeight: '1.2',
}));

export const MetDescription = styled(Typography)(() => ({
    fontSize: '13px',
    fontFamily: MET_Header_Font_Family,
    color: '#707070',
}));

export const HeaderTitle = styled(Typography)(() => ({
    fontSize: '32px',
    fontWeight: 'bold',
    fontFamily: MET_Header_Font_Family,
}));

export const MetSmallText = ({ bold, children, sx, ...rest }: HeaderProps) => {
    return (
        <Typography
            sx={{
                ...sx,
                fontSize: '13px',
                fontFamily: MET_Header_Font_Family,
                fontWeight: bold ? 'bold' : MET_Header_Font_Weight,
            }}
            variant="subtitle1"
            {...rest}
        >
            {children}
        </Typography>
    );
};

export const MetHeader1 = ({ bold, children, sx, ...rest }: HeaderProps) => {
    return (
        <Typography
            sx={{
                ...sx,
                fontSize: '1.5rem',
                lineHeight: 1.25,
                fontWeight: MET_Header_Font_Weight,
                fontFamily: MET_Header_Font_Family,
            }}
            variant="h1"
            {...rest}
        >
            {children}
        </Typography>
    );
};

export const MetHeader2 = ({ bold, children, sx, ...rest }: HeaderProps) => {
    return (
        <Typography
            sx={{
                ...sx,
                fontSize: '1.9rem',
                fontWeight: MET_Header_Font_Weight,
                fontFamily: MET_Header_Font_Family,
            }}
            variant="h2"
            {...rest}
        >
            {children}
        </Typography>
    );
};

export const MetHeader3 = ({ bold, children, sx, ...rest }: HeaderProps) => {
    return (
        <Typography
            sx={{
                ...sx,
                fontSize: '1.5rem',
                fontWeight: MET_Header_Font_Weight,
                fontFamily: MET_Header_Font_Family,
            }}
            variant="h3"
            {...rest}
        >
            {children}
        </Typography>
    );
};

export const MetHeader4 = ({ bold, color, children, sx, ...rest }: HeaderProps) => {
    return (
        <Typography
            color={color}
            sx={{
                ...sx,
                fontSize: '1.3rem',
                fontWeight: MET_Header_Font_Weight,
                fontFamily: MET_Header_Font_Family,
            }}
            variant="h4"
            {...rest}
        >
            {children}
        </Typography>
    );
};

export const MetBody = ({ bold, children, sx, ...rest }: HeaderProps) => {
    return (
        <Typography
            sx={{
                ...sx,
                fontSize: '16px',
                fontFamily: MET_Header_Font_Family,
                fontWeight: bold ? 'bold' : MET_Font_Weight,
            }}
            {...rest}
        >
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

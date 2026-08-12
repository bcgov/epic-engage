import React from 'react';
import { ButtonBase, alpha } from '@mui/material';
import { Palette, statusStyles } from 'styles/Theme';
import { CommentStatus } from 'constants/commentStatus';
import Icon from '@mui/material/Icon';

interface BadgeProps {
    children: React.ReactNode;
    onClick?: () => void;
}
export const ApprovedIcon = ({ children, onClick }: BadgeProps) => {
    return (
        <ButtonBase onClick={onClick}>
            <Icon
                sx={{
                    backgroundColor: alpha(Palette.success.emphasis, 0.2),
                    '&:hover': {
                        backgroundColor: Palette.success.emphasis,
                        color: Palette.text.invert,
                    },
                    borderRadius: '3px',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '1.8em',
                    minWidth: '2em',
                    width: 'fit-content',
                }}
            >
                {children}
            </Icon>
        </ButtonBase>
    );
};

export const NFRIcon = ({ children, onClick }: BadgeProps) => {
    return (
        <ButtonBase onClick={onClick}>
            <Icon
                sx={{
                    backgroundColor: statusStyles[CommentStatus.NeedsFurtherReview].background,
                    '&:hover': {
                        backgroundColor: statusStyles[CommentStatus.NeedsFurtherReview].borderColor,
                    },
                    borderRadius: '3px',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '1.8em',
                    minWidth: '2em',
                    width: 'fit-content',
                }}
            >
                {children}
            </Icon>
        </ButtonBase>
    );
};

export const RejectedIcon = ({ children, onClick }: BadgeProps) => {
    return (
        <ButtonBase onClick={onClick}>
            <Icon
                sx={{
                    backgroundColor: statusStyles[CommentStatus.Rejected].background,
                    '&:hover': {
                        backgroundColor: statusStyles[CommentStatus.Rejected].borderColor,
                    },
                    borderRadius: '3px',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '1.8em',
                    minWidth: '2em',
                    width: 'fit-content',
                    padding: 0,
                }}
            >
                {children}
            </Icon>
        </ButtonBase>
    );
};

export const NewIcon = ({ children, onClick }: BadgeProps) => {
    return (
        <ButtonBase onClick={onClick}>
            <Icon
                sx={{
                    border: `2px solid ${Palette.primary.main}`,
                    '&:hover': {
                        backgroundColor: Palette.primary.main,
                        color: Palette.text.invert,
                        textDecoration: 'underline',
                    },
                    borderRadius: '3px',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '1.8em',
                    minWidth: '2em',
                    width: 'fit-content',
                    padding: 0,
                }}
            >
                {children}
            </Icon>
        </ButtonBase>
    );
};

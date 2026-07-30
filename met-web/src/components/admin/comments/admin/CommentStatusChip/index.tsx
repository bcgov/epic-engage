import React from 'react';
import { Chip } from '@mui/material';
import { CommentStatus, COMMENTS_STATUS } from 'constants/commentStatus';
import { statusStyles } from 'styles/Theme';

// Colours come from the shared status map so chips, table cells and listing icons stay in step.
export const CommentStatusChip = ({ commentStatus }: { commentStatus: CommentStatus }) => {
    const style = statusStyles[commentStatus];
    if (!style) {
        return null;
    }
    return (
        <Chip
            label={COMMENTS_STATUS[commentStatus]}
            sx={{
                fontWeight: 500,
                backgroundColor: style.background,
                border: `1px solid ${style.borderColor}`,
            }}
        />
    );
};

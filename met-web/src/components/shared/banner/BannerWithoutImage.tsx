import React from 'react';
import { Box } from '@mui/material';
import { BannerProps } from 'components/public/engagement/view/types';
import { Palette } from 'styles/Theme';

const BannerWithoutImage = ({ children }: BannerProps) => {
    return (
        <Box
            sx={{
                backgroundColor: Palette.background.light,
                width: '100%',
                position: 'relative',
            }}
        >
            <Box
                sx={{
                    height: '20em',
                    width: '100%',
                }}
            >
                {children}
            </Box>
        </Box>
    );
};

export default BannerWithoutImage;

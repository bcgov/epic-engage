import { Box, Link as MuiLink, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { Palette } from 'styles/Theme';

export interface BreadcrumbItem {
    label: string;
    to?: string;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
}

export const Breadcrumb = ({ items }: BreadcrumbProps) => {
    return (
        <Stack
            direction="row"
            alignItems="center"
            flexWrap="wrap"
            sx={{
                px: { xs: 2, md: 4.5 },
                borderBottom: `1px solid ${Palette.border.default}`,
                backgroundColor: Palette.background.default,
            }}
        >
            {items.map((item, index) => {
                const isLast = index === items.length - 1;
                return (
                    <Stack key={item.label} direction="row" alignItems="center">
                        {item.to && !isLast ? (
                            <MuiLink
                                component={Link}
                                to={item.to}
                                underline="always"
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    py: 1,
                                    px: 1,
                                    borderRadius: '4px',
                                    color: Palette.action.active,
                                    fontSize: '14px',
                                    '&:hover': { backgroundColor: Palette.button.tertiary.hoverBackgroundColor },
                                }}
                            >
                                {item.label}
                            </MuiLink>
                        ) : (
                            <Typography sx={{ fontSize: '16px', color: Palette.text.primary, py: '6px' }}>
                                {item.label}
                            </Typography>
                        )}
                        {!isLast && (
                            <Box sx={{ px: 0.5, color: Palette.border.dark, fontSize: '16px' }} component="span">
                                /
                            </Box>
                        )}
                    </Stack>
                );
            })}
        </Stack>
    );
};

export default Breadcrumb;

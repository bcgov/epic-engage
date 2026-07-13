import { Box, Link as MuiLink, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

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
                borderBottom: '1px solid #D8D8D8',
                backgroundColor: '#FFFFFF',
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
                                    color: '#255A90',
                                    fontSize: '14px',
                                    '&:hover': { backgroundColor: '#ECEAE8' },
                                }}
                            >
                                {item.label}
                            </MuiLink>
                        ) : (
                            <Typography sx={{ fontSize: '16px', color: '#2D2D2D', py: '6px' }}>
                                {item.label}
                            </Typography>
                        )}
                        {!isLast && (
                            <Box sx={{ px: 0.5, color: '#323130', fontSize: '16px' }} component="span">
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

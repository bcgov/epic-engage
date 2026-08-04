import { Box, Typography } from '@mui/material';
import { Palette } from 'styles/Theme';

export interface HorizontalBarListItem {
    label: string;
    pct: number;
    count: number;
}

interface HorizontalBarListProps {
    data: HorizontalBarListItem[];
    // Optional swatch colour per row, matched to the donut segment of the same response.
    colors?: string[];
    // Response given by the most respondents, rendered in bold.
    highlightLabel?: string;
    categoryLabel?: string;
}

const GRID_COLUMNS = '1fr 130px 90px';

const headerSx = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#474543',
};

/**
 * Response / % of respondents / count list, shared by the donut legend and the
 * checkbox results. Rows are rendered in the order they are given, which is the
 * order the options appear on the survey.
 */
export const HorizontalBarList = ({
    data,
    colors,
    highlightLabel,
    categoryLabel = 'Response',
}: HorizontalBarListProps) => {
    return (
        <Box>
            {/* Column headers */}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: GRID_COLUMNS,
                    gap: 1,
                    px: 0.5,
                    pb: 0.75,
                    borderBottom: '1px solid #D8D8D8',
                    mb: 0.5,
                }}
            >
                <Typography sx={headerSx}>{categoryLabel}</Typography>
                <Typography sx={{ ...headerSx, textAlign: 'right', whiteSpace: 'nowrap' }}>% of Respondents</Typography>
                <Typography sx={{ ...headerSx, textAlign: 'right', pr: 3 }}>Count</Typography>
            </Box>

            {data.map((item, i) => (
                <Box
                    key={item.label}
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: GRID_COLUMNS,
                        alignItems: 'center',
                        gap: 1,
                        px: 0.5,
                        py: 1,
                        borderBottom: i < data.length - 1 ? '1px solid #F0EFEE' : 'none',
                        '&:hover': { background: '#F7F8FA', borderRadius: '4px' },
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        {colors && (
                            <Box
                                sx={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    flexShrink: 0,
                                    background: colors[i % colors.length],
                                }}
                            />
                        )}
                        <Typography
                            sx={{
                                fontSize: 13,
                                color: Palette.text.primary,
                                fontWeight: item.label === highlightLabel ? 700 : 400,
                            }}
                        >
                            {item.label}
                        </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: Palette.primary.main, textAlign: 'right' }}>
                        {item.pct}%
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#474543', textAlign: 'right', pr: 3 }}>
                        {item.count.toLocaleString()}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
};

export default HorizontalBarList;

import { Box, Typography } from '@mui/material';
import { Palette } from 'styles/Theme';

export interface HorizontalBarListItem {
    label: string;
    pct: number;
    count: number;
}

interface HorizontalBarListProps {
    data: HorizontalBarListItem[];
    multiSelect?: boolean;
}

export const HorizontalBarList = ({ data, multiSelect = false }: HorizontalBarListProps) => {
    const sorted = [...data].sort((a, b) => b.pct - a.pct);
    const maxPct = sorted[0]?.pct ?? 100;

    return (
        <Box>
            {multiSelect && (
                <Box
                    sx={{
                        fontSize: 13,
                        color: Palette.primary.main,
                        background: '#E3EEF9',
                        borderLeft: `4px solid ${Palette.primary.main}`,
                        borderRadius: '4px',
                        px: 1.5,
                        py: 1,
                        mb: 1.5,
                    }}
                >
                    Respondents could select multiple options. Percentages show the share who selected each option.
                </Box>
            )}

            {/* Column headers */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    columnGap: 1,
                    pb: 0.75,
                    borderBottom: '1px solid #D8D8D8',
                    mb: 0.5,
                }}
            >
                <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#474543', width: 44, textAlign: 'right' }}>
                    %
                </Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#474543', width: 64, textAlign: 'right' }}>
                    Count
                </Typography>
            </Box>

            {sorted.map((item, i) => (
                <Box
                    key={item.label}
                    sx={{
                        px: 0.5,
                        py: 0.75,
                        borderBottom: i < sorted.length - 1 ? '1px solid #F0EFEE' : 'none',
                        '&:hover': { background: '#F7F8FA', borderRadius: '4px' },
                    }}
                >
                    {/* Label row with pct and count */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Typography sx={{ flex: 1, fontSize: 13, color: Palette.text.primary }}>
                            {item.label}
                        </Typography>
                        <Typography sx={{ width: 44, fontSize: 13, fontWeight: 700, color: Palette.primary.main, textAlign: 'right' }}>
                            {item.pct}%
                        </Typography>
                        <Typography sx={{ width: 64, fontSize: 12, color: '#474543', textAlign: 'right' }}>
                            {item.count.toLocaleString()}
                        </Typography>
                    </Box>

                    {/* Proportional bar */}
                    <Box sx={{ height: 6, borderRadius: '3px', background: '#EEEEEE', overflow: 'hidden' }}>
                        <Box
                            sx={{
                                height: '100%',
                                width: `${maxPct > 0 ? (item.pct / maxPct) * 100 : 0}%`,
                                background: Palette.primary.main,
                                borderRadius: '3px',
                            }}
                        />
                    </Box>
                </Box>
            ))}
        </Box>
    );
};

export default HorizontalBarList;

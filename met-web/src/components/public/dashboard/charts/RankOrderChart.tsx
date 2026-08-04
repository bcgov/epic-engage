import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Palette } from 'styles/Theme';

// Ramp running from 1st place to last place. A survey can rank any number of options, so for
// more places than the ramp has stops the colour is sampled across it.
const RANK_RAMP = ['#1B5E8C', '#4A90C4', '#90C0DE', '#F5C97A', '#E07B39'];
const DARK_RANK_COLORS = new Set(['#1B5E8C', '#4A90C4', '#E07B39']);

const rankColor = (place: number, places: number): string => {
    if (places <= RANK_RAMP.length) {
        return RANK_RAMP[place] ?? RANK_RAMP[RANK_RAMP.length - 1];
    }
    return RANK_RAMP[Math.round((place * (RANK_RAMP.length - 1)) / (places - 1))];
};

const rankTextColor = (place: number, places: number): string =>
    DARK_RANK_COLORS.has(rankColor(place, places)) ? '#fff' : '#2D2D2D';

// 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th, 21st
const ordinal = (place: number): string => {
    const n = place + 1;
    const tens = n % 100;
    if (tens >= 11 && tens <= 13) {
        return `${n}th`;
    }
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

export interface RankOrderItem {
    label: string;
    // One entry per rank position: ranks[0] = % who ranked this 1st, ranks[1] = 2nd, etc.
    ranks: number[];
}

interface ScoredItem extends RankOrderItem {
    score: number;
}

function computeScore(ranks: number[]): number {
    return ranks.reduce((sum, pct, i) => sum + pct * (i + 1), 0) / 100;
}

interface TooltipState {
    x: number;
    y: number;
    text: string;
}

interface RankOrderChartProps {
    data: RankOrderItem[];
}

export const RankOrderChart = ({ data }: RankOrderChartProps) => {
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);

    // Options stay in survey order; the medal shows where each one placed on the
    // weighted score (a lower average rank is a better placing).
    const scored: ScoredItem[] = data.map((d) => ({ ...d, score: computeScore(d.ranks) }));
    const byScore = [...scored].sort((a, b) => a.score - b.score);
    const placeOf = (item: ScoredItem) => byScore.indexOf(item);

    const numRanks = data[0]?.ranks.length ?? 0;
    const rankLabels = Array.from({ length: numRanks }, (_, i) => ordinal(i));

    return (
        <Box>
            {/* Legend */}
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25, mb: 2 }}>
                <Typography sx={{ fontSize: 12, color: '#474543', fontWeight: 600 }}>Ranked:</Typography>
                {rankLabels.map((lbl, ri) => (
                    <Box key={lbl} sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
                        <Box
                            sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '2px',
                                flexShrink: 0,
                                background: rankColor(ri, numRanks),
                            }}
                        />
                        <Typography sx={{ fontSize: 12, color: '#474543' }}>{lbl}</Typography>
                    </Box>
                ))}
            </Box>

            {/* Rows */}
            {scored.map((item, i) => {
                // Stack reads 1st place first, matching the legend
                const stackSegments = item.ranks.map((pct, rankIndex) => ({ pct, rankIndex }));
                const place = placeOf(item);

                return (
                    <Box
                        key={item.label}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: '24px 1fr auto',
                            alignItems: 'center',
                            gap: 1.75,
                            px: 0.5,
                            py: 1.25,
                            borderBottom: i < scored.length - 1 ? '1px solid #F0EFEE' : 'none',
                            '&:hover': { background: '#F7F8FA', borderRadius: '4px' },
                        }}
                    >
                        {/* Position medal */}
                        <Box
                            sx={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                background: rankColor(place, scored.length),
                                color: rankTextColor(place, scored.length),
                                fontSize: 11,
                                fontWeight: 700,
                            }}
                        >
                            {place + 1}
                        </Box>

                        {/* Label + stacked bar */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography sx={{ fontSize: 13, color: Palette.text.primary, fontWeight: 500 }}>
                                {item.label}
                            </Typography>
                            <Box
                                sx={{
                                    display: 'flex',
                                    height: 20,
                                    borderRadius: '3px',
                                    overflow: 'hidden',
                                    width: '100%',
                                }}
                            >
                                {stackSegments.map(({ pct, rankIndex }) => {
                                    if (pct < 1) return null;
                                    return (
                                        <Box
                                            key={rankIndex}
                                            sx={{
                                                width: `${pct}%`,
                                                height: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 10,
                                                fontWeight: 700,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                cursor: 'default',
                                                transition: 'opacity 0.15s',
                                                background: rankColor(rankIndex, numRanks),
                                                color: rankTextColor(rankIndex, numRanks),
                                                '&:hover': { opacity: 0.82 },
                                            }}
                                            onMouseMove={(e) =>
                                                setTooltip({
                                                    x: e.clientX,
                                                    y: e.clientY,
                                                    text: `Ranked ${rankLabels[rankIndex]}: ${pct}%`,
                                                })
                                            }
                                            onMouseLeave={() => setTooltip(null)}
                                        >
                                            {pct >= 8 ? `${pct}%` : ''}
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>

                        {/* Weighted score */}
                        <Box sx={{ textAlign: 'right', minWidth: 80 }}>
                            <Typography
                                component="span"
                                display="block"
                                sx={{ fontSize: 20, fontWeight: 700, color: Palette.primary.main, lineHeight: 1.2 }}
                            >
                                {item.score.toFixed(2)}
                            </Typography>
                            <Typography component="span" display="block" sx={{ fontSize: 11, color: '#474543' }}>
                                avg. rank score
                            </Typography>
                        </Box>
                    </Box>
                );
            })}

            {/* Floating tooltip */}
            {tooltip && (
                <Box
                    sx={{
                        position: 'fixed',
                        top: tooltip.y - 36,
                        left: tooltip.x + 14,
                        background: Palette.primary.main,
                        color: '#fff',
                        fontSize: 12,
                        px: 1.5,
                        py: 0.75,
                        borderRadius: '6px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                        pointerEvents: 'none',
                        zIndex: 9999,
                        whiteSpace: 'nowrap',
                    }}
                >
                    {tooltip.text}
                </Box>
            )}
        </Box>
    );
};

export default RankOrderChart;

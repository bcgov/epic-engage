import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Palette } from 'styles/Theme';

// Colors indexed by rank position (0 = 1st place, 4 = 5th place)
const RANK_COLORS = ['#1B5E8C', '#4A90C4', '#90C0DE', '#F5C97A', '#E07B39'];
const RANK_TEXT_COLORS = ['#fff', '#fff', '#2D2D2D', '#2D2D2D', '#fff'];
const RANK_LABELS = ['1st', '2nd', '3rd', '4th', '5th'];

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

    const scored: ScoredItem[] = [...data]
        .map((d) => ({ ...d, score: computeScore(d.ranks) }))
        .sort((a, b) => a.score - b.score);

    const numRanks = data[0]?.ranks.length ?? 5;
    const rankLabels = RANK_LABELS.slice(0, numRanks);

    return (
        <Box>
            {/* Legend */}
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25, mb: 2 }}>
                <Typography sx={{ fontSize: 12, color: '#474543', fontWeight: 600 }}>Ranked:</Typography>
                {/* Reversed so legend reads 5th→1st left-to-right, matching the bar stack */}
                {[...rankLabels].reverse().map((lbl, ri) => {
                    const origIndex = numRanks - 1 - ri;
                    return (
                        <Box key={lbl} sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
                            <Box
                                sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '2px',
                                    flexShrink: 0,
                                    background: RANK_COLORS[origIndex],
                                }}
                            />
                            <Typography sx={{ fontSize: 12, color: '#474543' }}>{lbl}</Typography>
                        </Box>
                    );
                })}
            </Box>

            {/* Rows */}
            {scored.map((item, i) => {
                // Stack renders lowest-ranked (rightmost index) first so 1st-rank anchors the right
                const stackSegments = [...item.ranks]
                    .map((pct, rankIndex) => ({ pct, rankIndex }))
                    .reverse();

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
                                background: RANK_COLORS[i] ?? '#C8C3BE',
                                color: RANK_TEXT_COLORS[i] ?? '#2D2D2D',
                                fontSize: 11,
                                fontWeight: 700,
                            }}
                        >
                            {i + 1}
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
                                                background: RANK_COLORS[rankIndex] ?? '#C8C3BE',
                                                color: RANK_TEXT_COLORS[rankIndex] ?? '#2D2D2D',
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

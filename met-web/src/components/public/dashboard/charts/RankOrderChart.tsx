import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Palette } from 'styles/Theme';
import { formatOrdinal } from './ordinal';

const FALLBACK_STYLE = {
    fill: Palette.chart.fallback.swatch,
    border: Palette.chart.fallback.swatch,
    label: Palette.chart.fallback.label,
};

// Colours for a rank position (0 = 1st place). Ranks past the palette fall back to a borderless grey.
const rankStyle = (rankIndex: number) => Palette.chart.rank[rankIndex] ?? FALLBACK_STYLE;

export interface RankOrderItem {
    label: string;
    // One entry per rank position: ranks[0] = % who ranked this 1st, ranks[1] = 2nd, etc.
    ranks: number[];
}

interface ScoredItem extends RankOrderItem {
    score: number;
    placement: number;
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

    const scores = data.map((d) => computeScore(d.ranks));
    // Lower weighted score = ranked more highly, so placement is the count of items that beat it.
    const scored: ScoredItem[] = data
        .map((d, i) => ({
            ...d,
            score: scores[i],
            placement: scores.filter((s, j) => s < scores[i] || (s === scores[i] && j < i)).length,
        }))
        .sort((a, b) => a.placement - b.placement);

    const numRanks = data[0]?.ranks.length ?? 5;
    const rankLabels = Array.from({ length: numRanks }, (_, i) => formatOrdinal(i + 1));

    return (
        <Box>
            {/* Legend */}
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25, mb: 2 }}>
                <Typography sx={{ fontSize: 12, color: Palette.text.secondary, fontWeight: 600 }}>Ranked:</Typography>
                {rankLabels.map((lbl, rankIndex) => (
                    <Box key={lbl} sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
                        <Box
                            sx={{
                                width: 12,
                                height: 12,
                                boxSizing: 'border-box',
                                borderRadius: '3px',
                                flexShrink: 0,
                                background: rankStyle(rankIndex).fill,
                                border: `1px solid ${rankStyle(rankIndex).border}`,
                            }}
                        />
                        <Typography sx={{ fontSize: 12, color: Palette.text.secondary }}>{lbl}</Typography>
                    </Box>
                ))}
            </Box>

            {/* Rows */}
            {scored.map((item, i) => {
                // 1st rank anchors the left, matching the legend. Segments under 1% aren't drawn, so the
                // bar's rounded ends go on the first and last segments that are.
                const segments = item.ranks.map((pct, rankIndex) => ({ pct, rankIndex })).filter(({ pct }) => pct >= 1);

                return (
                    <Box
                        key={item.label}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: '24px 1fr',
                            alignItems: 'center',
                            gap: 1.75,
                            px: 0.5,
                            py: 1.25,
                            borderBottom:
                                i < scored.length - 1 ? `1px solid ${Palette.chart.surface.rowDivider}` : 'none',
                            '&:hover': { background: Palette.chart.surface.rowHover, borderRadius: '4px' },
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
                                boxSizing: 'border-box',
                                background: rankStyle(item.placement).fill,
                                border: `1px solid ${rankStyle(item.placement).border}`,
                                color: rankStyle(item.placement).label,
                                fontSize: 11,
                                fontWeight: 700,
                            }}
                        >
                            {item.placement + 1}
                        </Box>

                        {/* Label + stacked bar + weighted score */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography sx={{ fontSize: 13, color: Palette.text.primary, fontWeight: 500 }}>
                                {item.label}
                            </Typography>
                            <Box sx={{ display: 'flex', height: 20, width: '100%' }}>
                                {segments.map(({ pct, rankIndex }, si) => {
                                    const { fill, border, label } = rankStyle(rankIndex);
                                    const left = si === 0 ? '3px' : 0;
                                    const right = si === segments.length - 1 ? '3px' : 0;
                                    return (
                                        <Box
                                            key={rankIndex}
                                            sx={{
                                                width: `${pct}%`,
                                                minWidth: 0,
                                                height: '100%',
                                                boxSizing: 'border-box',
                                                border: `1px solid ${border}`,
                                                borderRadius: `${left} ${right} ${right} ${left}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 10,
                                                fontWeight: 700,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                cursor: 'default',
                                                transition: 'opacity 0.15s',
                                                background: fill,
                                                color: label,
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
                            <Typography sx={{ fontSize: 12, color: Palette.text.secondary }}>
                                <Box component="span" sx={{ fontWeight: 700, color: Palette.text.primary }}>
                                    {item.score.toFixed(2)}
                                </Box>{' '}
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
                        color: Palette.text.invert,
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

import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Palette } from 'styles/Theme';

const COLORS = Palette.chart.categorical;

// Let the "% of Respondents" heading sit on one line instead of wrapping.
const COLUMNS = 'minmax(0, 1fr) 132px 72px';

// Label text is white on the dark segments and dark on the lighter ones; the pairing lives with
// the swatches in `Palette.chart` so the two indices can never drift apart.
const LABEL_COLOR = (i: number) => Palette.chart.categoricalLabel[i % COLORS.length];

export interface DonutChartItem {
    label: string;
    pct: number;
    count: number;
}

interface Segment {
    path: string;
    color: string;
    isTop: boolean;
    tooltipText: string;
    labelX: number | null;
    labelY: number | null;
    labelColor: string;
    pct: number;
}

function buildSegments(data: DonutChartItem[], top: DonutChartItem | undefined): Segment[] {
    const cx = 100, cy = 100, R = 80, r = 50;
    const total = data.reduce((s, d) => s + d.pct, 0);
    let startAngle = -Math.PI / 2;

    return data.map((d, i) => {
        const normPct = (d.pct / total) * 100;
        const slice = (Math.min(normPct, 99.9999) / 100) * 2 * Math.PI;
        const end = startAngle + slice;
        const gap = data.length > 1 ? 0.02 : 0;
        const s = startAngle + gap / 2;
        const e = end - gap / 2;

        const x1 = cx + R * Math.cos(s), y1 = cy + R * Math.sin(s);
        const x2 = cx + R * Math.cos(e), y2 = cy + R * Math.sin(e);
        const x3 = cx + r * Math.cos(e), y3 = cy + r * Math.sin(e);
        const x4 = cx + r * Math.cos(s), y4 = cy + r * Math.sin(s);
        const large = slice > Math.PI ? 1 : 0;

        const path = `M${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${large},0 ${x4},${y4} Z`;

        let labelX: number | null = null;
        let labelY: number | null = null;
        if (d.pct >= 10) {
            const mid = s + (e - s) / 2;
            labelX = cx + (r + (R - r) / 2) * Math.cos(mid);
            labelY = cy + (r + (R - r) / 2) * Math.sin(mid) + 4;
        }

        startAngle = end;

        return {
            path,
            color: COLORS[i % COLORS.length],
            isTop: d === top,
            tooltipText: `${d.label}: ${d.pct}%`,
            labelX,
            labelY,
            labelColor: LABEL_COLOR(i),
            pct: d.pct,
        };
    });
}

interface TooltipState {
    x: number;
    y: number;
    text: string;
}

interface DonutChartProps {
    data: DonutChartItem[];
    total: number;
    categoryLabel?: string;
}

export const DonutChart = ({ data, total, categoryLabel = 'Response' }: DonutChartProps) => {
    // Slices stay in survey option order; only the highlight picks out the largest response.
    const topItem = data.reduce<DonutChartItem | undefined>(
        (best, d) => (best && best.pct >= d.pct ? best : d),
        undefined,
    );
    const segments = buildSegments(data, topItem);

    const [tooltip, setTooltip] = useState<TooltipState | null>(null);

    return (
        <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Donut SVG */}
            <Box sx={{ position: 'relative', flexShrink: 0, width: 200, height: 200 }}>
                <svg viewBox="0 0 200 200" width="200" height="200">
                    {segments.map((seg, i) => (
                        <path
                            key={i}
                            d={seg.path}
                            fill={seg.color}
                            style={{
                                cursor: 'default',
                                transition: 'opacity 0.15s',
                                filter: seg.isTop ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : undefined,
                            }}
                            onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY, text: seg.tooltipText })}
                            onMouseLeave={() => setTooltip(null)}
                        />
                    ))}
                    {segments.map((seg, i) =>
                        seg.labelX !== null && seg.labelY !== null ? (
                            <text
                                key={`lbl-${i}`}
                                x={seg.labelX}
                                y={seg.labelY}
                                textAnchor="middle"
                                fontSize={11}
                                fontWeight={700}
                                fill={seg.labelColor}
                                style={{ pointerEvents: 'none' }}
                            >
                                {seg.pct}%
                            </text>
                        ) : null,
                    )}
                </svg>
                {/* Centre label */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        pointerEvents: 'none',
                    }}
                >
                    <Typography
                        component="span"
                        display="block"
                        sx={{ fontSize: 22, fontWeight: 700, color: Palette.primary.main, lineHeight: 1.1 }}
                    >
                        {total.toLocaleString()}
                    </Typography>
                    <Typography component="span" display="block" sx={{ fontSize: 11, color: Palette.text.secondary }}>
                        respondents
                    </Typography>
                </Box>
            </Box>

            {/* Legend list */}
            <Box sx={{ flex: 1, minWidth: 320 }}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: COLUMNS,
                        gap: 1,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: Palette.text.secondary,
                        px: 0.5,
                        pb: 0.75,
                        borderBottom: `1px solid ${Palette.border.default}`,
                        mb: 0.5,
                    }}
                >
                    <Box sx={{ whiteSpace: 'nowrap' }}>{categoryLabel}</Box>
                    <Box sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>% of Respondents</Box>
                    <Box sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Count</Box>
                </Box>
                {data.map((item, i) => {
                    const isTop = item === topItem;
                    return (
                        <Box
                            key={item.label}
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: COLUMNS,
                                alignItems: 'center',
                                gap: 1,
                                px: 0.5,
                                py: 1,
                                borderBottom: i < data.length - 1 ? `1px solid ${Palette.chart.surface.rowDivider}` : 'none',
                                '&:hover': { background: Palette.chart.surface.rowHover, borderRadius: '4px' },
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Box
                                    sx={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: '50%',
                                        flexShrink: 0,
                                        background: COLORS[i % COLORS.length],
                                    }}
                                />
                                <Typography sx={{ fontSize: 13, color: Palette.text.primary, fontWeight: isTop ? 700 : 400 }}>
                                    {item.label}
                                </Typography>
                            </Box>
                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: Palette.primary.main, textAlign: 'right' }}>
                                {item.pct}%
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: Palette.text.secondary, textAlign: 'right' }}>
                                {item.count.toLocaleString()}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>

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
                        maxWidth: 240,
                        whiteSpace: 'nowrap',
                    }}
                >
                    {tooltip.text}
                </Box>
            )}
        </Box>
    );
};

export default DonutChart;

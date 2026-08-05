import { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Palette } from 'styles/Theme';

// Scale colors: [negative, neutral, somewhat, positive, strongly positive]
const COLORS = Palette.chart.likert;
// Label text colour per scale point, paired with COLORS above
const LABEL_COLORS = Palette.chart.likertLabel;

const LABEL_W = 220;
const N_COL_W = 70;
const BAR_GAP = 20;
const BAR_H = 24;
const ROW_H = 44;
const PAD_TOP = 30;
const PAD_L = 12;
const PAD_R = 12;
const CORNER_R = 3;

const DEFAULT_SCALE_LABELS = ['Not effective', 'Neutral', 'Somewhat effective', 'Effective', 'Very effective'];

const NEUTRAL_INDEX = 1;

export interface LikertRow {
    label: string;
    pcts: number[];
    n: number;
}

interface TooltipState {
    x: number;
    y: number;
    text: string;
}

interface SegmentDef {
    x: number;
    w: number;
    pct: number;
    ci: number;
    isFirst: boolean;
    isLast: boolean;
}

// SVG path helpers for segments with single-side rounded corners
function pathRoundedLeft(x: number, y: number, w: number, h: number, r: number): string {
    return `M${x + r},${y} h${w - r} v${h} h${-(w - r)} a${r},${r} 0 0 1 -${r},-${r} v${-(h - 2 * r)} a${r},${r} 0 0 1 ${r},-${r} z`;
}
function pathRoundedRight(x: number, y: number, w: number, h: number, r: number): string {
    return `M${x},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 -${r},${r} h${-(w - r)} z`;
}
function pathRect(x: number, y: number, w: number, h: number): string {
    return `M${x},${y} h${w} v${h} h${-w} z`;
}

function segmentPath(s: SegmentDef): string {
    const { x, w, isFirst, isLast } = s;
    if (isFirst) return pathRoundedLeft(x, 0, w, BAR_H, CORNER_R);
    if (isLast) return pathRoundedRight(x, 0, w, BAR_H, CORNER_R);
    return pathRect(x, 0, w, BAR_H);
}

// Wrap label text at last word boundary before maxChars
function wrapLabel(label: string, maxChars = 34): [string, string] {
    if (label.length <= maxChars) return [label, ''];
    const breakAt = label.lastIndexOf(' ', maxChars);
    if (breakAt === -1) return [label.slice(0, maxChars), label.slice(maxChars)];
    return [label.slice(0, breakAt), label.slice(breakAt + 1)];
}

interface LikertChartProps {
    data: LikertRow[];
    // Labels for each scale point, in order, used by the legend, axis header and tooltips.
    scaleLabels?: string[];
    // Overrides the axis header, which otherwise names the two ends of the scale above.
    axisLabels?: [string, string];
}

export const LikertChart = ({ data, scaleLabels = DEFAULT_SCALE_LABELS, axisLabels }: LikertChartProps) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);
    const clipId = useRef(`likert-clip-${Math.random().toString(36).slice(2)}`).current;

    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        setWidth(el.clientWidth);
        const observer = new ResizeObserver((entries) => {
            setWidth(entries[0].contentRect.width);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const scaleLength = data.reduce((longest, d) => Math.max(longest, d.pcts.length), 0);
    const labels = Array.from({ length: scaleLength }, (_, i) => scaleLabels[i] ?? `Scale point ${i + 1}`);
    const [axisStart, axisEnd] = axisLabels ?? [labels[0] ?? 'Negative', labels[labels.length - 1] ?? 'Positive'];

    const totalW = width || 700;
    const barLeft = LABEL_W + PAD_L + 16;
    const barRight = totalW - PAD_R - N_COL_W - BAR_GAP;
    const barColW = barRight - barLeft;
    const svgH = PAD_TOP + data.length * ROW_H + 8;

    const leftOfAxis = (pcts: number[]) => (pcts[NEUTRAL_INDEX] ?? 0) / 2
        + pcts.slice(0, NEUTRAL_INDEX).reduce((sum, pct) => sum + pct, 0);
    const rightOfAxis = (pcts: number[]) => (pcts[NEUTRAL_INDEX] ?? 0) / 2
        + pcts.slice(NEUTRAL_INDEX + 1).reduce((sum, pct) => sum + pct, 0);

    const leftExtent = data.reduce((widest, d) => Math.max(widest, leftOfAxis(d.pcts)), 0);
    const rightExtent = data.reduce((widest, d) => Math.max(widest, rightOfAxis(d.pcts)), 0);
    const span = leftExtent + rightExtent || 100;
    const px = barColW / span;
    const cx = barLeft + leftExtent * px;
    const headerX = barLeft + barColW / 2;

    return (
        <Box>
            {/* Legend */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', rowGap: 0.75, columnGap: 2, mb: 1.75 }}>
                {labels.map((lbl, i) => (
                    <Box key={lbl} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box
                            sx={{
                                width: 13,
                                height: 13,
                                borderRadius: '3px',
                                flexShrink: 0,
                                background: COLORS[i] ?? Palette.chart.fallback.swatch,
                            }}
                        />
                        <Typography sx={{ fontSize: 12, color: Palette.text.secondary }}>{lbl}</Typography>
                    </Box>
                ))}
            </Box>

            {/* SVG chart */}
            <Box ref={wrapperRef} sx={{ width: '100%', overflowX: 'auto' }}>
                {width > 0 && (
                    <svg width={totalW} height={svgH} viewBox={`0 0 ${totalW} ${svgH}`}>
                        <defs>
                            <clipPath id={clipId}>
                                <rect x={barLeft} y={0} width={barColW} height={svgH} />
                            </clipPath>
                        </defs>

                        {/* Column headers */}
                        <text x={PAD_L} y={18} fontSize={10} fontWeight={600} fill={Palette.text.secondary} letterSpacing={0.5}>
                            RESPONSE
                        </text>
                        <text x={headerX} y={18} fontSize={10} fontWeight={600} fill={Palette.text.secondary} letterSpacing={0.5} textAnchor="middle">
                            {`← ${axisStart.toUpperCase()}  |  ${axisEnd.toUpperCase()} →`}
                        </text>
                        <text x={barRight + BAR_GAP} y={18} fontSize={10} fontWeight={600} fill={Palette.text.secondary} letterSpacing={0.5}>
                            COUNT
                        </text>
                        <line x1={PAD_L} y1={PAD_TOP - 4} x2={totalW - PAD_R} y2={PAD_TOP - 4} stroke={Palette.border.default} strokeWidth={1} />

                        {data.map((row, i) => {
                            const y0 = PAD_TOP + i * ROW_H;
                            const barY = y0 + (ROW_H - BAR_H) / 2;

                            const lastIndex = row.pcts.length - 1;
                            let cursor = cx - leftOfAxis(row.pcts) * px;
                            const segs: SegmentDef[] = row.pcts.map((pct, ci) => {
                                const w = pct * px;
                                const seg: SegmentDef = {
                                    x: cursor,
                                    w,
                                    pct,
                                    ci,
                                    isFirst: ci === 0,
                                    isLast: ci === lastIndex,
                                };
                                cursor += w;
                                return seg;
                            });

                            const [line1, line2] = wrapLabel(row.label);
                            const tY = line2 ? barY + BAR_H / 2 - 5 : barY + BAR_H / 2 + 4;

                            return (
                                <g key={row.label}>
                                    {/* Alternating row background */}
                                    {i % 2 === 0 && (
                                        <rect x={PAD_L} y={y0} width={totalW - PAD_L - PAD_R} height={ROW_H} fill={Palette.chart.surface.rowHover} rx={2} />
                                    )}

                                    {/* Row label (up to 2 lines) */}
                                    <text x={PAD_L + 4} y={tY} fontSize={12} fill={Palette.text.primary}>{line1}</text>
                                    {line2 && (
                                        <text x={PAD_L + 4} y={tY + 14} fontSize={12} fill={Palette.text.primary}>{line2}</text>
                                    )}

                                    {/* Bar segments */}
                                    <g clipPath={`url(#${clipId})`} transform={`translate(0, ${barY})`}>
                                        {segs.map((s) => {
                                            if (s.w < 0.5) return null;
                                            const path = segmentPath(s);
                                            const labelColor = LABEL_COLORS[s.ci] ?? Palette.chart.fallback.label;
                                            return (
                                                <g key={s.ci}>
                                                    <path
                                                        d={path}
                                                        fill={COLORS[s.ci] ?? Palette.chart.fallback.swatch}
                                                        style={{ cursor: 'default', transition: 'opacity 0.15s' }}
                                                        onMouseMove={(e) =>
                                                            setTooltip({
                                                                x: e.clientX,
                                                                y: e.clientY,
                                                                text: `${labels[s.ci]}: ${s.pct}%`,
                                                            })
                                                        }
                                                        onMouseLeave={() => setTooltip(null)}
                                                    />
                                                    {s.w > 20 && (
                                                        <text
                                                            x={s.x + s.w / 2}
                                                            y={BAR_H / 2 + 4}
                                                            fontSize={10}
                                                            fontWeight={700}
                                                            fill={labelColor}
                                                            textAnchor="middle"
                                                            style={{ pointerEvents: 'none' }}
                                                        >
                                                            {s.pct}%
                                                        </text>
                                                    )}
                                                </g>
                                            );
                                        })}
                                    </g>

                                    {/* Centre axis dashed line */}
                                    <line
                                        x1={cx} y1={barY - 1}
                                        x2={cx} y2={barY + BAR_H + 1}
                                        stroke={Palette.text.disabled}
                                        strokeWidth={1.5}
                                        strokeDasharray="3,2"
                                    />

                                    {/* N count */}
                                    <text x={barRight + BAR_GAP} y={barY + BAR_H / 2 + 4} fontSize={11} fill={Palette.text.secondary}>
                                        {row.n.toLocaleString()}
                                    </text>

                                    {/* Row divider */}
                                    <line
                                        x1={PAD_L} y1={y0 + ROW_H}
                                        x2={totalW - PAD_R} y2={y0 + ROW_H}
                                        stroke={Palette.chart.surface.rowDivider}
                                        strokeWidth={1}
                                    />
                                </g>
                            );
                        })}
                    </svg>
                )}
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
                        whiteSpace: 'nowrap',
                    }}
                >
                    {tooltip.text}
                </Box>
            )}
        </Box>
    );
};

export default LikertChart;

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Palette } from 'styles/Theme';
import { MET_Header_Font_Family } from 'styles/constants';

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
const HEADER_GAP = 6;
const LABEL_FONT_SIZE = 12;
const LABEL_LINE_H = 14;
// Labels are inset from both edges of the column so they never touch the bars.
const LABEL_INSET = 4;
const LABEL_MAX_W = LABEL_W - LABEL_INSET * 2;
// Last line is ellipsised.
const LABEL_MAX_LINES = 4;

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

// measure label lines off-screen with a canvas.
let measureCtx: CanvasRenderingContext2D | null | undefined;
function getMeasureContext(): CanvasRenderingContext2D | null {
    if (measureCtx === undefined) {
        try {
            measureCtx = document.createElement('canvas').getContext('2d');
        } catch {
            measureCtx = null;
        }
        if (measureCtx) measureCtx.font = `${LABEL_FONT_SIZE}px ${MET_Header_Font_Family}`;
    }
    return measureCtx;
}

// Falls back to an average-width estimate.
function textWidth(text: string): number {
    const ctx = getMeasureContext();
    if (ctx) return ctx.measureText(text).width;
    return text.length * LABEL_FONT_SIZE * 0.55;
}

function ellipsise(line: string, maxWidth: number): string {
    let text = `${line}…`;
    while (text.length > 1 && textWidth(text) > maxWidth) {
        text = `${text.slice(0, -2)}…`;
    }
    return text;
}

// Wrap label text on word boundaries so it fits inside label column.
function wrapLabel(label: string, maxWidth = LABEL_MAX_W, maxLines = LABEL_MAX_LINES): string[] {
    const lines: string[] = [];
    let current = '';

    for (const word of label.split(/\s+/).filter(Boolean)) {
        const candidate = current ? `${current} ${word}` : word;
        if (textWidth(candidate) <= maxWidth) {
            current = candidate;
            continue;
        }
        if (current) lines.push(current);

        let rest = word;
        while (textWidth(rest) > maxWidth) {
            let cut = rest.length - 1;
            while (cut > 1 && textWidth(rest.slice(0, cut)) > maxWidth) cut--;
            lines.push(rest.slice(0, cut));
            rest = rest.slice(cut);
        }
        current = rest;
    }
    if (current) lines.push(current);
    if (!lines.length) return [label];

    if (lines.length > maxLines) {
        const kept = lines.slice(0, maxLines);
        kept[maxLines - 1] = ellipsise(kept[maxLines - 1], maxWidth);
        return kept;
    }
    return lines;
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

    // Grow rows to fit however many lines their label wraps to
    const rows = useMemo(() => {
        let y = PAD_TOP;
        return data.map((row) => {
            const lines = wrapLabel(row.label);
            const h = Math.max(ROW_H, lines.length * LABEL_LINE_H + 16);
            const layout = { row, lines, y, h };
            y += h;
            return layout;
        });
    }, [data]);
    const svgH = rows.reduce((sum, r) => sum + r.h, PAD_TOP + 8);

    const leftOfAxis = (pcts: number[]) => (pcts[NEUTRAL_INDEX] ?? 0) / 2
        + pcts.slice(0, NEUTRAL_INDEX).reduce((sum, pct) => sum + pct, 0);
    const rightOfAxis = (pcts: number[]) => (pcts[NEUTRAL_INDEX] ?? 0) / 2
        + pcts.slice(NEUTRAL_INDEX + 1).reduce((sum, pct) => sum + pct, 0);

    const leftExtent = data.reduce((widest, d) => Math.max(widest, leftOfAxis(d.pcts)), 0);
    const rightExtent = data.reduce((widest, d) => Math.max(widest, rightOfAxis(d.pcts)), 0);
    const span = leftExtent + rightExtent || 100;
    const px = barColW / span;
    const cx = barLeft + leftExtent * px;

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
                        <text x={cx - HEADER_GAP} y={18} fontSize={10} fontWeight={600} fill={Palette.text.secondary} letterSpacing={0.5} textAnchor="end">
                            {`← ${axisStart.toUpperCase()}`}
                        </text>
                        <text x={cx} y={18} fontSize={10} fontWeight={600} fill={Palette.text.secondary} textAnchor="middle">
                            |
                        </text>
                        <text x={cx + HEADER_GAP} y={18} fontSize={10} fontWeight={600} fill={Palette.text.secondary} letterSpacing={0.5} textAnchor="start">
                            {`${axisEnd.toUpperCase()} →`}
                        </text>
                        <text x={barRight + BAR_GAP} y={18} fontSize={10} fontWeight={600} fill={Palette.text.secondary} letterSpacing={0.5}>
                            COUNT
                        </text>
                        <line x1={PAD_L} y1={PAD_TOP - 4} x2={totalW - PAD_R} y2={PAD_TOP - 4} stroke={Palette.border.default} strokeWidth={1} />

                        {rows.map(({ row, lines, y: y0, h: rowH }, i) => {
                            const barY = y0 + (rowH - BAR_H) / 2;

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

                            const firstBaseline = y0 + (rowH - lines.length * LABEL_LINE_H) / 2 + LABEL_LINE_H - 3;

                            return (
                                <g key={row.label}>
                                    {/* Alternating row background */}
                                    {i % 2 === 0 && (
                                        <rect x={PAD_L} y={y0} width={totalW - PAD_L - PAD_R} height={rowH} fill={Palette.chart.surface.rowHover} rx={2} />
                                    )}

                                    {/* Row label */}
                                    <g>
                                        <title>{row.label}</title>
                                        {lines.map((line, li) => (
                                            <text
                                                key={line + li}
                                                x={PAD_L + LABEL_INSET}
                                                y={firstBaseline + li * LABEL_LINE_H}
                                                fontSize={LABEL_FONT_SIZE}
                                                fill={Palette.text.primary}
                                            >
                                                {line}
                                            </text>
                                        ))}
                                    </g>

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
                                        x1={PAD_L} y1={y0 + rowH}
                                        x2={totalW - PAD_R} y2={y0 + rowH}
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

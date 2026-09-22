import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Palette } from 'styles/Theme';
import { MET_Header_Font_Family } from 'styles/constants';
import { LikertScalePoint } from 'models/analytics/surveyResult';
import { resolveLikertScale, ResolvedSegment } from './likertScale';

const LABEL_W = 220;
const N_COL_W = 70;
const BAR_GAP = 20;
const BAR_H = 24;
const ROW_H = 44;
const PAD_TOP = 30;
const PAD_L = 12;
const PAD_R = 12;
const CORNER_R = 3;
// "Not sure" sits outside the scale: its own column between the bars and COUNT.
const NS_W = 52;
const NS_GAP = 14;
const HEADER_GAP = 6;
const LABEL_FONT_SIZE = 12;
const LABEL_LINE_H = 14;
// Labels are inset from both edges of the column so they never touch the bars.
const LABEL_INSET = 4;
const LABEL_MAX_W = LABEL_W - LABEL_INSET * 2;
// Last line is ellipsised.
const LABEL_MAX_LINES = 4;

const DEFAULT_SCALE_LABELS = ['Not effective', 'Neutral', 'Somewhat effective', 'Effective', 'Very effective'];

export interface LikertRow {
    label: string;
    pcts: number[];
    n: number;
    not_sure_pct?: number | null;
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
    roundLeft: boolean;
    roundRight: boolean;
}

// A visible segment needs at least one pixel to contain its border.
const MIN_SEGMENT_W = 1;
const SEGMENT_STROKE = 1;

// Segment outline, rounded only on the sides that end the visible bar.
function segmentPath({ x, w, roundLeft, roundRight }: SegmentDef): string {
    // Inset by half the stroke so the whole border sits inside the segment, like a CSS border,
    // and no edge is lost to the bar column's clip.
    const inset = SEGMENT_STROKE / 2;
    const sw = Math.max(w - SEGMENT_STROKE, 0);
    const sh = BAR_H - SEGMENT_STROKE;
    const r = Math.max(0, Math.min(CORNER_R - inset, sw / 2));
    const rl = roundLeft ? r : 0;
    const rr = roundRight ? r : 0;
    const arc = (rad: number, dx: number, dy: number) => (rad ? `a${rad},${rad} 0 0 1 ${dx},${dy} ` : '');
    return (
        `M${x + inset + rl},${inset} h${sw - rl - rr} ${arc(rr, rr, rr)}v${sh - 2 * rr} ${arc(rr, -rr, rr)}` +
        `h${-(sw - rl - rr)} ${arc(rl, -rl, -rl)}v${-(sh - 2 * rl)} ${arc(rl, rl, -rl)}z`
    );
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
    // Each scale point's classification, in the same order as scaleLabels. Absent or unclassified: legacy scale.
    scale?: LikertScalePoint[];
    // Show the separate Not sure column.
    hasNotSure?: boolean;
}

export const LikertChart = ({
    data,
    scaleLabels = DEFAULT_SCALE_LABELS,
    axisLabels,
    scale,
    hasNotSure = false,
}: LikertChartProps) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [pixelOffset, setPixelOffset] = useState({ x: 0, y: 0 });
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

    // Text above the chart and flex/grid columns can put the entire SVG between pixels.
    // Align its origin as well as its internal geometry; otherwise even integer bar edges blur.
    useLayoutEffect(() => {
        const rect = wrapperRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = Math.round(rect.left) - rect.left;
        const y = Math.round(rect.top) - rect.top;
        setPixelOffset((previous) => (previous.x === x && previous.y === y ? previous : { x, y }));
    });

    const scaleLength = data.reduce((longest, d) => Math.max(longest, d.pcts.length), 0);
    const labels = Array.from({ length: scaleLength }, (_, i) => scaleLabels[i] ?? `Scale point ${i + 1}`);
    const [axisStart, axisEnd] = axisLabels ?? [labels[0] ?? 'Negative', labels[labels.length - 1] ?? 'Positive'];

    const { diverging, segments } = resolveLikertScale(labels, scale);
    const segmentAt = (i: number): ResolvedSegment =>
        segments[i] ?? {
            label: labels[i],
            fill: Palette.chart.fallback.swatch,
            border: Palette.chart.fallback.swatch,
            text: Palette.chart.fallback.label,
            polarity: 'positive',
        };

    // Keep SVG units at CSS pixel size even when ResizeObserver reports a fractional width.
    const totalW = Math.round(width) || 700;
    const barLeft = LABEL_W + PAD_L + 16;
    const countX = totalW - PAD_R - N_COL_W;
    const nsLeft = countX - BAR_GAP - NS_W;
    const barRight = hasNotSure ? nsLeft - NS_GAP : countX - BAR_GAP;
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

    // Everything negative, plus half of neutral, sits left of the centre axis.
    const sideOf = (pcts: number[], side: 'negative' | 'positive') =>
        pcts.reduce((sum, pct, i) => {
            const { polarity } = segmentAt(i);
            if (polarity === 'neutral') return sum + pct / 2;
            return polarity === side ? sum + pct : sum;
        }, 0);
    const leftOfAxis = (pcts: number[]) => (diverging ? sideOf(pcts, 'negative') : 0);
    const rightOfAxis = (pcts: number[]) => (diverging ? sideOf(pcts, 'positive') : pcts.reduce((s, p) => s + p, 0));

    const leftExtent = data.reduce((widest, d) => Math.max(widest, leftOfAxis(d.pcts)), 0);
    const rightExtent = data.reduce((widest, d) => Math.max(widest, rightOfAxis(d.pcts)), 0);
    const span = leftExtent + rightExtent || 100;
    const px = barColW / span;
    const axisX = barLeft + leftExtent * px;
    const cx = Math.round(axisX);

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
                                background: segmentAt(i).fill,
                                border: `1px solid ${segmentAt(i).border}`,
                            }}
                        />
                        <Typography sx={{ fontSize: 12, color: Palette.text.secondary }}>{lbl}</Typography>
                    </Box>
                ))}
                {hasNotSure && (
                    <Box
                        data-testid="likert-legend-not-sure"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 1.5 }}
                    >
                        <Box
                            sx={{
                                width: 13,
                                height: 13,
                                borderRadius: '3px',
                                flexShrink: 0,
                                background: Palette.chart.likertNotSure.fill,
                                border: `1px solid ${Palette.chart.likertNotSure.border}`,
                            }}
                        />
                        <Typography sx={{ fontSize: 12, color: Palette.text.secondary }}>Not sure</Typography>
                    </Box>
                )}
            </Box>

            {/* SVG chart */}
            <Box ref={wrapperRef} sx={{ width: '100%', overflowX: 'auto' }}>
                {width > 0 && (
                    <svg
                        width={totalW}
                        height={svgH}
                        viewBox={`0 0 ${totalW} ${svgH}`}
                        style={{ display: 'block', position: 'relative', left: pixelOffset.x, top: pixelOffset.y }}
                    >
                        <defs>
                            <clipPath id={clipId}>
                                <rect x={barLeft} y={0} width={barColW} height={svgH} />
                            </clipPath>
                        </defs>

                        {/* Column headers */}
                        <text
                            x={PAD_L}
                            y={18}
                            fontSize={10}
                            fontWeight={600}
                            fill={Palette.text.secondary}
                            letterSpacing={0.5}
                        >
                            RESPONSE
                        </text>
                        {diverging && (
                            <>
                                <text
                                    x={cx - HEADER_GAP}
                                    y={18}
                                    fontSize={10}
                                    fontWeight={600}
                                    fill={Palette.text.secondary}
                                    letterSpacing={0.5}
                                    textAnchor="end"
                                >
                                    {`← ${axisStart.toUpperCase()}`}
                                </text>
                                <text
                                    x={cx}
                                    y={18}
                                    fontSize={10}
                                    fontWeight={600}
                                    fill={Palette.text.secondary}
                                    textAnchor="middle"
                                >
                                    |
                                </text>
                                <text
                                    x={cx + HEADER_GAP}
                                    y={18}
                                    fontSize={10}
                                    fontWeight={600}
                                    fill={Palette.text.secondary}
                                    letterSpacing={0.5}
                                    textAnchor="start"
                                >
                                    {`${axisEnd.toUpperCase()} →`}
                                </text>
                            </>
                        )}
                        <text
                            x={countX}
                            y={18}
                            fontSize={10}
                            fontWeight={600}
                            fill={Palette.text.secondary}
                            letterSpacing={0.5}
                        >
                            COUNT
                        </text>
                        {hasNotSure && (
                            <text
                                x={nsLeft + NS_W / 2}
                                y={18}
                                fontSize={10}
                                fontWeight={600}
                                fill={Palette.text.secondary}
                                letterSpacing={0.5}
                                textAnchor="middle"
                            >
                                NOT SURE
                            </text>
                        )}
                        <line
                            x1={PAD_L}
                            y1={PAD_TOP - 4}
                            x2={totalW - PAD_R}
                            y2={PAD_TOP - 4}
                            stroke={Palette.border.default}
                            strokeWidth={1}
                        />

                        {rows.map(({ row, lines, y: y0, h: rowH }, i) => {
                            const barY = y0 + (rowH - BAR_H) / 2;

                            // Snap shared boundaries, not individual widths: adjacent segments must meet,
                            // and a 1px inset stroke must land on half-pixel coordinates to stay sharp.
                            let cursor = axisX - leftOfAxis(row.pcts) * px;
                            const segs: SegmentDef[] = row.pcts
                                .map((pct, ci) => {
                                    const x = Math.round(cursor);
                                    cursor += pct * px;
                                    return {
                                        x,
                                        w: Math.round(cursor) - x,
                                        pct,
                                        ci,
                                        roundLeft: false,
                                        roundRight: false,
                                    };
                                })
                                .filter((s) => s.w >= MIN_SEGMENT_W);
                            // Determine the ends after snapping: zero-width categories do not own corners.
                            if (segs.length) {
                                segs[0].roundLeft = true;
                                segs[segs.length - 1].roundRight = true;
                            }

                            const firstBaseline = y0 + (rowH - lines.length * LABEL_LINE_H) / 2 + LABEL_LINE_H - 3;

                            return (
                                <g key={row.label}>
                                    {/* Alternating row background */}
                                    {i % 2 === 0 && (
                                        <rect
                                            x={PAD_L}
                                            y={y0}
                                            width={totalW - PAD_L - PAD_R}
                                            height={rowH}
                                            fill={Palette.chart.surface.rowHover}
                                            rx={2}
                                        />
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

                                    {/* Keep the axis in the row gutters so it cannot obscure borders or corners. */}
                                    {diverging && (
                                        <g stroke={Palette.text.disabled} strokeWidth={1.5} strokeDasharray="3,2">
                                            <line
                                                data-testid="likert-axis"
                                                strokeDasharray="3,2"
                                                x1={cx}
                                                y1={y0}
                                                x2={cx}
                                                y2={barY - CORNER_R}
                                            />
                                            <line x1={cx} y1={barY + BAR_H + CORNER_R} x2={cx} y2={y0 + rowH} />
                                        </g>
                                    )}

                                    {/* Bar segments */}
                                    <g clipPath={`url(#${clipId})`} transform={`translate(0, ${barY})`}>
                                        {segs.map((s) => {
                                            const path = segmentPath(s);
                                            const { fill, border, text: labelColor } = segmentAt(s.ci);
                                            return (
                                                <g key={s.ci}>
                                                    <path
                                                        data-testid="likert-segment"
                                                        d={path}
                                                        fill={fill}
                                                        stroke={border}
                                                        strokeWidth={SEGMENT_STROKE}
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

                                    {/* Not sure badge */}
                                    {hasNotSure && (
                                        <g
                                            data-testid="likert-not-sure"
                                            onMouseMove={(e) =>
                                                setTooltip({
                                                    x: e.clientX,
                                                    y: e.clientY,
                                                    text: `Not sure: ${row.not_sure_pct ?? 0}%`,
                                                })
                                            }
                                            onMouseLeave={() => setTooltip(null)}
                                        >
                                            <rect
                                                x={nsLeft + SEGMENT_STROKE / 2}
                                                y={barY + SEGMENT_STROKE / 2}
                                                width={NS_W - SEGMENT_STROKE}
                                                height={BAR_H - SEGMENT_STROKE}
                                                rx={CORNER_R - SEGMENT_STROKE / 2}
                                                fill={Palette.chart.likertNotSure.fill}
                                                stroke={Palette.chart.likertNotSure.border}
                                                strokeWidth={1}
                                            />
                                            <text
                                                x={nsLeft + NS_W / 2}
                                                y={barY + BAR_H / 2 + 4}
                                                fontSize={10}
                                                fontWeight={700}
                                                fill={Palette.chart.likertNotSure.label}
                                                textAnchor="middle"
                                                style={{ pointerEvents: 'none' }}
                                            >
                                                {`${row.not_sure_pct ?? 0}%`}
                                            </text>
                                        </g>
                                    )}

                                    {/* N count */}
                                    <text
                                        x={countX}
                                        y={barY + BAR_H / 2 + 4}
                                        fontSize={11}
                                        fill={Palette.text.secondary}
                                    >
                                        {row.n.toLocaleString()}
                                    </text>

                                    {/* Row divider */}
                                    <line
                                        x1={PAD_L}
                                        y1={y0 + rowH}
                                        x2={totalW - PAD_R}
                                        y2={y0 + rowH}
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

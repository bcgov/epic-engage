import { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Palette } from 'styles/Theme';
import { buildScaleColors, dividePcts, findNeutralIndex, isDarkSegment } from './likertScale';

const LABEL_W = 200;
const COUNT_W = 48;
const PAD_L = 12;
const PAD_R = 80;
const GAP = 10;
const BAR_H = 22;
const PAD_TOP = 32;
const BASE_ROW_H = 44;
const LINE_H = 16;
const WRAP_CHARS = 28;
const CORNER_R = 3;

export interface LikertRow {
    label: string;
    // One percentage per scale option, in survey order.
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
    return `M${x + r},${y} h${w - r} v${h} h${-(w - r)} a${r},${r} 0 0 1 -${r},-${r} v${-(
        h -
        2 * r
    )} a${r},${r} 0 0 1 ${r},-${r} z`;
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

// Wrap label text onto as many lines as it needs, breaking on word boundaries.
function wrapText(text: string, maxChars = WRAP_CHARS): string[] {
    if (text.length <= maxChars) return [text];
    const lines: string[] = [];
    let current = '';
    text.split(' ').forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= maxChars) {
            current = candidate;
        } else {
            if (current) lines.push(current);
            current = word;
        }
    });
    if (current) lines.push(current);
    return lines;
}

interface LikertChartProps {
    data: LikertRow[];
    // The answer scale in survey order, e.g. ['Least important', ..., 'Most important'].
    // Drives the legend, the axis headers and the segment colours.
    scaleLabels: string[];
}

export const LikertChart = ({ data, scaleLabels }: LikertChartProps) => {
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

    const colors = buildScaleColors(scaleLabels);
    const neutralIndex = findNeutralIndex(scaleLabels);
    const axisStart = scaleLabels[0] ?? '';
    const axisEnd = scaleLabels[scaleLabels.length - 1] ?? '';

    // Rows keep the order they appear on the survey.
    const extents = data.map((row) => dividePcts(row.pcts, neutralIndex));
    const maxLeft = Math.max(...extents.map((e) => e.left), 0);
    const maxRight = Math.max(...extents.map((e) => e.right), 0);
    const totalPct = maxLeft + maxRight || 100;

    const totalW = width || 700;
    const barLeft = PAD_L + LABEL_W + GAP;
    const barRight = totalW - PAD_R - COUNT_W - GAP;
    const barColW = barRight - barLeft;
    const px = barColW / totalPct;
    // Centre line sits at the same x for every row so the rows can be compared.
    const centreX = barLeft + maxLeft * px;

    const rowLines = data.map((row) => wrapText(row.label));
    const rowHeights = rowLines.map((lines) => Math.max(BASE_ROW_H, lines.length * LINE_H + 20));
    const rowTops = rowHeights.reduce<number[]>((tops, height, i) => {
        tops.push(i === 0 ? PAD_TOP : tops[i - 1] + rowHeights[i - 1]);
        return tops;
    }, []);
    const svgH = PAD_TOP + rowHeights.reduce((sum, h) => sum + h, 0) + 8;

    return (
        <Box>
            {/* Legend */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', rowGap: 0.75, columnGap: 2, mb: 1.75 }}>
                {scaleLabels.map((lbl, i) => (
                    <Box key={lbl} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box
                            sx={{ width: 13, height: 13, borderRadius: '3px', flexShrink: 0, background: colors[i] }}
                        />
                        <Typography sx={{ fontSize: 12, color: '#474543' }}>{lbl}</Typography>
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
                        <text x={PAD_L} y={18} fontSize={10} fontWeight={600} fill="#474543" letterSpacing={0.5}>
                            RESPONSE
                        </text>
                        <text
                            x={centreX}
                            y={18}
                            fontSize={10}
                            fontWeight={600}
                            fill="#474543"
                            letterSpacing={0.5}
                            textAnchor="middle"
                        >
                            {`← ${axisStart.toUpperCase()}  |  ${axisEnd.toUpperCase()} →`}
                        </text>
                        <text
                            x={barRight + GAP}
                            y={18}
                            fontSize={10}
                            fontWeight={600}
                            fill="#474543"
                            letterSpacing={0.5}
                        >
                            COUNT
                        </text>
                        <line
                            x1={PAD_L}
                            y1={PAD_TOP - 4}
                            x2={totalW - PAD_R}
                            y2={PAD_TOP - 4}
                            stroke="#D8D8D8"
                            strokeWidth={1}
                        />

                        {data.map((row, i) => {
                            const y0 = rowTops[i];
                            const rowH = rowHeights[i];
                            const barY = y0 + (rowH - BAR_H) / 2;

                            // Segments are laid out from the centre line outwards: the neutral option is
                            // split in half across it, everything before it grows left, the rest grows right.
                            const halfNeutral = neutralIndex === -1 ? 0 : ((row.pcts[neutralIndex] ?? 0) * px) / 2;
                            const segs: SegmentDef[] = [];
                            let leftEdge = centreX - halfNeutral;
                            for (
                                let ci = (neutralIndex === -1 ? row.pcts.length / 2 : neutralIndex) - 1;
                                ci >= 0;
                                ci--
                            ) {
                                const w = row.pcts[ci] * px;
                                leftEdge -= w;
                                segs.push({ x: leftEdge, w, pct: row.pcts[ci], ci, isFirst: ci === 0, isLast: false });
                            }
                            if (neutralIndex !== -1) {
                                segs.push({
                                    x: centreX - halfNeutral,
                                    w: halfNeutral * 2,
                                    pct: row.pcts[neutralIndex] ?? 0,
                                    ci: neutralIndex,
                                    isFirst: neutralIndex === 0,
                                    isLast: neutralIndex === row.pcts.length - 1,
                                });
                            }
                            let rightEdge = centreX + halfNeutral;
                            const firstPositive = neutralIndex === -1 ? row.pcts.length / 2 : neutralIndex + 1;
                            for (let ci = firstPositive; ci < row.pcts.length; ci++) {
                                const w = row.pcts[ci] * px;
                                segs.push({
                                    x: rightEdge,
                                    w,
                                    pct: row.pcts[ci],
                                    ci,
                                    isFirst: false,
                                    isLast: ci === row.pcts.length - 1,
                                });
                                rightEdge += w;
                            }

                            const lines = rowLines[i];
                            const textTop = barY + BAR_H / 2 + 4 - ((lines.length - 1) * LINE_H) / 2;

                            return (
                                <g key={row.label}>
                                    {/* Alternating row background */}
                                    {i % 2 === 0 && (
                                        <rect
                                            x={PAD_L}
                                            y={y0}
                                            width={totalW - PAD_L - PAD_R}
                                            height={rowH}
                                            fill="#F7F8FA"
                                            rx={2}
                                        />
                                    )}

                                    {/* Row label */}
                                    {lines.map((line, li) => (
                                        <text
                                            key={line}
                                            x={PAD_L + 4}
                                            y={textTop + li * LINE_H}
                                            fontSize={12}
                                            fill="#2D2D2D"
                                        >
                                            {line}
                                        </text>
                                    ))}

                                    {/* Bar segments */}
                                    <g clipPath={`url(#${clipId})`} transform={`translate(0, ${barY})`}>
                                        {segs.map((s) => {
                                            if (s.w < 0.5) return null;
                                            const labelColor = isDarkSegment(colors[s.ci]) ? '#fff' : '#2D2D2D';
                                            return (
                                                <g key={s.ci}>
                                                    <path
                                                        d={segmentPath(s)}
                                                        fill={colors[s.ci]}
                                                        style={{ cursor: 'default', transition: 'opacity 0.15s' }}
                                                        onMouseMove={(e) =>
                                                            setTooltip({
                                                                x: e.clientX,
                                                                y: e.clientY,
                                                                text: `${scaleLabels[s.ci]}: ${s.pct}%`,
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
                                        x1={centreX}
                                        y1={barY - 1}
                                        x2={centreX}
                                        y2={barY + BAR_H + 1}
                                        stroke="#9F9D9C"
                                        strokeWidth={1.5}
                                        strokeDasharray="3,2"
                                    />

                                    {/* N count */}
                                    <text x={barRight + GAP} y={barY + BAR_H / 2 + 4} fontSize={11} fill="#474543">
                                        {row.n.toLocaleString()}
                                    </text>

                                    {/* Row divider */}
                                    <line
                                        x1={PAD_L}
                                        y1={y0 + rowH}
                                        x2={totalW - PAD_R}
                                        y2={y0 + rowH}
                                        stroke="#ECEAE8"
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

export default LikertChart;

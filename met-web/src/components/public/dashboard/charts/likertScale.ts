// Colour and layout rules for a likert scale of any length.
//
// A likert scale runs from the most negative option to the most positive one, sometimes with a
// neutral option in between. The neutral option straddles the centre line of the diverging bar,
// negative options grow to the left of it and positive options to the right.

const NEUTRAL_COLOR = '#C8C3BE';

const NEGATIVE_RAMPS: string[][] = [
    [],
    ['#C03F2C'],
    ['#C03F2C', '#E07B39'],
    ['#C03F2C', '#D2603A', '#E8956A'],
    ['#C03F2C', '#CE5634', '#DC6F3D', '#E8956A'],
];

const POSITIVE_RAMPS: string[][] = [
    [],
    ['#1B5E8C'],
    ['#7EB8D4', '#1B5E8C'],
    ['#E8A94A', '#7EB8D4', '#1B5E8C'],
    ['#E8A94A', '#90C0DE', '#4A90C4', '#1B5E8C'],
    ['#F5C97A', '#E8A94A', '#90C0DE', '#4A90C4', '#1B5E8C'],
];

// Segment colours dark enough to need white text on top.
const DARK_COLORS = new Set(['#C03F2C', '#CE5634', '#D2603A', '#DC6F3D', '#E07B39', '#1B5E8C', '#4A90C4']);

const NEUTRAL_LABELS = ['neutral', 'no opinion', 'not sure', 'unsure', "don't know", 'no preference'];

const rampOfLength = (ramps: string[][], count: number): string[] => {
    if (count <= 0) return [];
    const ramp = ramps[Math.min(count, ramps.length - 1)];
    // Longer scales than we have a ramp for repeat the extreme colour on the far end.
    return count <= ramps.length - 1 ? ramp : [...Array(count - ramp.length).fill(ramp[0]), ...ramp];
};

/**
 * Index of the option that sits on the centre line, or -1 when the scale has no middle option.
 * A "Neutral" style option is used when the survey has one, otherwise a scale with an odd number
 * of options is split down its middle option.
 */
export const findNeutralIndex = (scaleLabels: string[]): number => {
    const labelled = scaleLabels.findIndex((label) => NEUTRAL_LABELS.includes(label.trim().toLowerCase()));
    if (labelled !== -1) {
        return labelled;
    }
    return scaleLabels.length % 2 === 1 ? (scaleLabels.length - 1) / 2 : -1;
};

export const buildScaleColors = (scaleLabels: string[]): string[] => {
    const neutralIndex = findNeutralIndex(scaleLabels);
    if (neutralIndex === -1) {
        const half = scaleLabels.length / 2;
        return [...rampOfLength(NEGATIVE_RAMPS, half), ...rampOfLength(POSITIVE_RAMPS, half)];
    }
    return [
        ...rampOfLength(NEGATIVE_RAMPS, neutralIndex),
        NEUTRAL_COLOR,
        ...rampOfLength(POSITIVE_RAMPS, scaleLabels.length - neutralIndex - 1),
    ];
};

export const isDarkSegment = (color: string): boolean => DARK_COLORS.has(color);

/**
 * How far a row extends to the left and to the right of the centre line, in percentage points.
 * The neutral option is split evenly across the centre line.
 */
export const dividePcts = (pcts: number[], neutralIndex: number): { left: number; right: number } => {
    const splitAt = neutralIndex === -1 ? pcts.length / 2 : neutralIndex;
    const left = pcts.slice(0, splitAt).reduce((sum, pct) => sum + pct, 0);
    const right = pcts.slice(neutralIndex === -1 ? splitAt : splitAt + 1).reduce((sum, pct) => sum + pct, 0);
    const neutral = neutralIndex === -1 ? 0 : pcts[neutralIndex] ?? 0;
    return { left: left + neutral / 2, right: right + neutral / 2 };
};

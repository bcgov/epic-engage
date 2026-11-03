import { Palette } from 'styles/Theme';
import { LikertClassification, LikertScalePoint } from 'models/analytics/surveyResult';

export type Polarity = 'negative' | 'neutral' | 'positive';

export interface ResolvedSegment {
    label: string;
    fill: string;
    // Outline drawn around the segment. Only the classification palette defines borders; the plain
    // stacked-bar fallback repeats its fill here so it keeps its existing borderless look.
    border: string;
    text: string;
    polarity: Polarity;
    // Steps from the centre of the scale: negatives count down from -1, positives up from +1.
    weight: number;
}

export interface ResolvedLikertScale {
    // false: a plain stacked bar with no centre axis.
    diverging: boolean;
    segments: ResolvedSegment[];
}

// Likert questions saved before classifications existed were fixed to this 5-point shape.
const LEGACY_FIVE: LikertClassification[] = ['neg3', 'neutral', 'pos1', 'pos2', 'pos3'];

const polarityOf = (c: LikertClassification): Polarity => {
    if (c === 'neutral') return 'neutral';
    return c.startsWith('neg') ? 'negative' : 'positive';
};

const fromClassification = (label: string, c: LikertClassification): ResolvedSegment => ({
    label,
    fill: Palette.chart.likertClassification[c].fill,
    border: Palette.chart.likertClassification[c].border,
    text: Palette.chart.likertClassification[c].label,
    polarity: polarityOf(c),
    weight: 0,
});

// Negatives sit first in rank order, so the nearest-centre negative is -1 and the outermost -n.
// Equals "position relative to Neutral" when there is one, and still works on scales without one.
const withWeights = (segments: ResolvedSegment[]): ResolvedSegment[] => {
    const negatives = segments.filter((s) => s.polarity === 'negative').length;
    let positives = 0;
    return segments.map((s, i) => {
        if (s.polarity === 'negative') return { ...s, weight: i - negatives };
        if (s.polarity === 'positive') return { ...s, weight: ++positives };
        return s;
    });
};

// Mean weight of the scored answers; Not sure is never in pcts. Null when there is nothing to score.
export function weightedScore(pcts: number[], { diverging, segments }: ResolvedLikertScale): number | null {
    if (!diverging) return null;
    const scored = pcts.reduce((sum, pct) => sum + pct, 0);
    if (scored <= 0) return null;
    return pcts.reduce((sum, pct, i) => sum + pct * (segments[i]?.weight ?? 0), 0) / scored;
}

// Anything the palette does not know, and any classification used twice, is drawn as legacy:
// the API passes unknown keys through, and duplicates would share a colour and skew the axis.
const isKnown = (c: LikertScalePoint['classification']): c is LikertClassification =>
    c !== null && c !== 'notSure' && c in Palette.chart.likertClassification;

export function resolveLikertScale(labels: string[], scale?: LikertScalePoint[]): ResolvedLikertScale {
    const classifications = scale?.map((p) => p.classification) ?? [];
    const classified =
        scale !== undefined &&
        scale.length > 0 &&
        scale.length === labels.length &&
        classifications.every(isKnown) &&
        new Set(classifications).size === scale.length;
    if (classified) {
        return {
            diverging: true,
            segments: withWeights(
                scale.map((p) => fromClassification(p.label, p.classification as LikertClassification)),
            ),
        };
    }
    if (labels.length === LEGACY_FIVE.length) {
        return {
            diverging: true,
            segments: withWeights(labels.map((label, i) => fromClassification(label, LEGACY_FIVE[i]))),
        };
    }
    return {
        diverging: false,
        segments: labels.map((label, i) => {
            const fill = Palette.chart.likert[i] ?? Palette.chart.fallback.swatch;
            return {
                label,
                fill,
                border: fill,
                text: Palette.chart.likertLabel[i] ?? Palette.chart.fallback.label,
                polarity: 'positive',
                weight: 0,
            };
        }),
    };
}

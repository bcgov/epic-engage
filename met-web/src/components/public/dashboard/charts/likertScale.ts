import { Palette } from 'styles/Theme';
import { LikertClassification, LikertScalePoint } from 'models/analytics/surveyResult';

export type Polarity = 'negative' | 'neutral' | 'positive';

export interface ResolvedSegment {
    label: string;
    fill: string;
    text: string;
    polarity: Polarity;
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
    text: Palette.chart.likertClassification[c].label,
    polarity: polarityOf(c),
});

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
            segments: scale.map((p) => fromClassification(p.label, p.classification as LikertClassification)),
        };
    }
    if (labels.length === LEGACY_FIVE.length) {
        return { diverging: true, segments: labels.map((label, i) => fromClassification(label, LEGACY_FIVE[i])) };
    }
    return {
        diverging: false,
        segments: labels.map((label, i) => ({
            label,
            fill: Palette.chart.likert[i] ?? Palette.chart.fallback.swatch,
            text: Palette.chart.likertLabel[i] ?? Palette.chart.fallback.label,
            polarity: 'positive',
        })),
    };
}

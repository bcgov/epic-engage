import { resolveLikertScale } from 'components/public/dashboard/charts/likertScale';
import { Palette } from 'styles/Theme';
import { LikertClassification, LikertScalePoint } from 'models/analytics/surveyResult';

const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const v = parseInt(hex.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

describe('resolveLikertScale', () => {
    it('colours a classified scale from the classification, not the position', () => {
        const { diverging, segments } = resolveLikertScale(['Disagree', 'Neutral', 'Agree'], [
            { label: 'Disagree', classification: 'neg2' },
            { label: 'Neutral', classification: 'neutral' },
            { label: 'Agree', classification: 'pos1' },
        ]);

        expect(diverging).toBe(true);
        expect(segments.map((s) => s.fill.toUpperCase())).toEqual(['#FBD389', '#E0DEDC', '#A8D0FB']);
        expect(segments.map((s) => s.polarity)).toEqual(['negative', 'neutral', 'positive']);
    });

    it('pairs every classification with its border colour', () => {
        const order: LikertClassification[] = ['neg3', 'neg2', 'neg1', 'neutral', 'pos1', 'pos2', 'pos3'];
        const { segments } = resolveLikertScale(
            order,
            order.map((classification) => ({ label: classification, classification })),
        );

        expect(segments.map((s) => s.border.toUpperCase())).toEqual([
            '#C99003', '#F8B230', '#F9D576', '#ABA6A0', '#469BF6', '#25507E', '#011E3D',
        ]);
    });

    it('leaves a plain stacked bar borderless by matching its fill', () => {
        const { segments } = resolveLikertScale(['a', 'b', 'c', 'd']);

        expect(segments.map((s) => s.border)).toEqual(segments.map((s) => s.fill));
    });

    it('treats an unclassified 5-point scale as neg3, neutral, pos1, pos2, pos3', () => {
        const labels = ['Not effective', 'Neutral', 'Somewhat effective', 'Effective', 'Very effective'];
        const { diverging, segments } = resolveLikertScale(
            labels,
            labels.map((label) => ({ label, classification: null })),
        );

        expect(diverging).toBe(true);
        expect(segments.map((s) => s.fill.toUpperCase())).toEqual([
            '#FCBA19', '#E0DEDC', '#A8D0FB', '#3470B1', '#013366',
        ]);
        expect(segments.map((s) => s.label)).toEqual(labels);
    });

    it('treats a 5-point scale with no scale data at all as the legacy mapping', () => {
        expect(resolveLikertScale(['a', 'b', 'c', 'd', 'e']).diverging).toBe(true);
    });

    it('draws an unclassified scale of any other length as a plain stacked bar', () => {
        const { diverging, segments } = resolveLikertScale(['a', 'b', 'c', 'd']);

        expect(diverging).toBe(false);
        expect(segments.map((s) => s.fill)).toEqual(Palette.chart.likert.slice(0, 4));
    });

    it.each(Object.entries(Palette.chart.likertClassification))(
        '%s segment text meets 4.5:1 contrast',
        (_key, { fill, label }) => {
            expect(contrast(fill, label)).toBeGreaterThanOrEqual(4.5);
        },
    );

    it('Not sure text meets 4.5:1 contrast', () => {
        expect(contrast(Palette.chart.likertNotSure.fill, Palette.chart.likertNotSure.label)).toBeGreaterThanOrEqual(4.5);
    });

    it('has a colour for every classification', () => {
        const keys: LikertClassification[] = ['neg3', 'neg2', 'neg1', 'neutral', 'pos1', 'pos2', 'pos3'];
        expect(Object.keys(Palette.chart.likertClassification).sort()).toEqual([...keys].sort());
    });
});

describe('resolveLikertScale guards', () => {
    const points = (...classifications: string[]) =>
        classifications.map((classification, i) => ({
            label: `p${i}`,
            classification: classification as LikertScalePoint['classification'],
        }));

    it('falls back to legacy when a classification is not one the palette knows', () => {
        const { diverging, segments } = resolveLikertScale(['p0', 'p1'], points('maybe', 'weird'));

        expect(diverging).toBe(false);
        expect(segments).toHaveLength(2);
    });

    it('falls back to legacy when a classification is used twice', () => {
        const { diverging } = resolveLikertScale(['p0', 'p1', 'p2'], points('pos1', 'pos1', 'neg1'));

        expect(diverging).toBe(false);
    });
});

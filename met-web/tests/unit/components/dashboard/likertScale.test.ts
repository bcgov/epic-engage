import { buildScaleColors, dividePcts, findNeutralIndex } from 'components/public/dashboard/charts/likertScale';

const EFFECTIVENESS = ['Not effective', 'Neutral', 'Somewhat effective', 'Effective', 'Very effective'];
const AGREEMENT = ['Strongly disagree', 'Disagree', 'Agree', 'Strongly agree'];

describe('likert scale', () => {
    it('finds the neutral option by its label', () => {
        expect(findNeutralIndex(EFFECTIVENESS)).toBe(1);
    });

    it('falls back to the middle option of an odd scale with no neutral label', () => {
        expect(findNeutralIndex(['Never', 'Sometimes', 'Always'])).toBe(1);
    });

    it('has no middle option on an even scale', () => {
        expect(findNeutralIndex(AGREEMENT)).toBe(-1);
    });

    it('gives every option on the scale a colour', () => {
        expect(buildScaleColors(EFFECTIVENESS)).toHaveLength(EFFECTIVENESS.length);
        expect(buildScaleColors(AGREEMENT)).toHaveLength(AGREEMENT.length);
        // The neutral option is the only grey one.
        expect(buildScaleColors(EFFECTIVENESS)[1]).toBe('#C8C3BE');
    });

    it('splits the neutral option across the centre line', () => {
        // 10% negative, 20% neutral, 70% spread over the positive options
        expect(dividePcts([10, 20, 30, 30, 10], 1)).toEqual({ left: 20, right: 80 });
    });

    it('splits an even scale down the middle', () => {
        expect(dividePcts([25, 25, 30, 20], -1)).toEqual({ left: 50, right: 50 });
    });
});

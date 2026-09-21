import { render } from '@testing-library/react';
import { LikertChart } from 'components/public/dashboard/charts/LikertChart';

// The chart only draws once it has measured its container.
beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 700 });
});

const pcts = [10, 20, 30, 20, 20];

// Bars begin at LABEL_W + PAD_L + 16; labels must stay left of that.
const BAR_LEFT = 248;

describe('LikertChart', () => {
    it('wraps a long row label over several lines that stay in the label column', () => {
        const label =
            'The questions asked in the survey gave me the chance to give the kind of feedback I wanted to give';
        const { container } = render(<LikertChart data={[{ label, pcts, n: 100 }]} />);

        const lines = Array.from(container.querySelectorAll('svg text')).filter(
            (t) => t.getAttribute('font-size') === '12',
        );
        expect(lines.length).toBeGreaterThan(2);
        lines.forEach((line) => {
            expect(Number(line.getAttribute('x'))).toBeLessThan(BAR_LEFT);
            // Rough guard against a line long enough to run under the bars.
            expect((line.textContent ?? '').length).toBeLessThanOrEqual(34);
        });
    });

    it('grows the row so a wrapped label is not clipped by the next row', () => {
        const short = render(<LikertChart data={[{ label: 'Clear', pcts, n: 10 }]} />);
        const shortHeight = Number(short.container.querySelector('svg')?.getAttribute('height'));

        const long = render(
            <LikertChart
                data={[
                    {
                        label: 'The questions asked in the survey gave me the chance to give the kind of feedback I wanted to give',
                        pcts,
                        n: 10,
                    },
                ]}
            />,
        );
        const longHeight = Number(long.container.querySelector('svg')?.getAttribute('height'));

        expect(longHeight).toBeGreaterThan(shortHeight);
    });

    const fills = (container: HTMLElement) =>
        Array.from(container.querySelectorAll('[data-testid="likert-segment"]')).map((p) =>
            (p.getAttribute('fill') ?? '').toUpperCase(),
        );

    const strokes = (container: HTMLElement) =>
        Array.from(container.querySelectorAll('[data-testid="likert-segment"]')).map((p) =>
            (p.getAttribute('stroke') ?? '').toUpperCase(),
        );

    it('outlines each classified segment with its border colour', () => {
        const scale = [
            { label: 'a', classification: 'neg2' as const },
            { label: 'b', classification: 'neg1' as const },
            { label: 'c', classification: 'neutral' as const },
            { label: 'd', classification: 'pos1' as const },
            { label: 'e', classification: 'pos2' as const },
        ];
        const { container } = render(
            <LikertChart data={[{ label: 'Row', pcts, n: 10 }]} scaleLabels={scale.map((s) => s.label)} scale={scale} />,
        );

        expect(strokes(container)).toEqual(['#F8B230', '#F9D576', '#ABA6A0', '#469BF6', '#25507E']);
    });

    it('colours a classified scale by classification', () => {
        const scale = [
            { label: 'Strongly disagree', classification: 'neg2' as const },
            { label: 'Disagree', classification: 'neg1' as const },
            { label: 'Neutral', classification: 'neutral' as const },
            { label: 'Agree', classification: 'pos1' as const },
            { label: 'Strongly agree', classification: 'pos2' as const },
        ];
        const { container } = render(
            <LikertChart data={[{ label: 'Row', pcts, n: 10 }]} scaleLabels={scale.map((s) => s.label)} scale={scale} />,
        );

        expect(fills(container)).toEqual(['#FBD389', '#FEF8E8', '#E0DEDC', '#A8D0FB', '#3470B1']);
    });

    it('keeps the legacy 5-point split for unclassified data', () => {
        const { container } = render(<LikertChart data={[{ label: 'Row', pcts, n: 10 }]} />);

        expect(fills(container)).toEqual(['#FCBA19', '#E0DEDC', '#A8D0FB', '#3470B1', '#013366']);
        expect(container.querySelector('[data-testid="likert-axis"]')).not.toBeNull();
    });

    it('puts the centre axis on the negative/positive boundary when there is no neutral', () => {
        const scale = [
            { label: 'Disagree', classification: 'neg1' as const },
            { label: 'Agree', classification: 'pos1' as const },
        ];
        const { container } = render(
            <LikertChart data={[{ label: 'Row', pcts: [40, 60], n: 10 }]} scaleLabels={['Disagree', 'Agree']} scale={scale} />,
        );

        const [neg, pos] = Array.from(container.querySelectorAll('[data-testid="likert-segment"]'));
        const axisX = Number(container.querySelector('[data-testid="likert-axis"]')?.getAttribute('x1'));
        // The negative segment's path starts at its left edge; the positive one starts at the axis.
        const startX = (p: Element) => Number((p.getAttribute('d') ?? '').match(/^M([\d.]+)/)?.[1]);
        expect(startX(pos)).toBeCloseTo(axisX, 0);
        expect(startX(neg)).toBeLessThan(axisX);
    });

    it('draws an unclassified 4-point scale with no centre axis', () => {
        const { container } = render(
            <LikertChart data={[{ label: 'Row', pcts: [25, 25, 25, 25], n: 4 }]} scaleLabels={['a', 'b', 'c', 'd']} />,
        );

        expect(container.querySelector('[data-testid="likert-axis"]')).toBeNull();
        expect(fills(container)).toHaveLength(4);
    });

    const eightPoint = [
        { label: 'N3', classification: 'neg3' as const },
        { label: 'N2', classification: 'neg2' as const },
        { label: 'N1', classification: 'neg1' as const },
        { label: 'Neutral', classification: 'neutral' as const },
        { label: 'P1', classification: 'pos1' as const },
        { label: 'P2', classification: 'pos2' as const },
        { label: 'P3', classification: 'pos3' as const },
    ];

    it('shows Not sure in its own column when the scale has one', () => {
        const { container, getByText, getByTestId } = render(
            <LikertChart
                data={[{ label: 'Row', pcts: [10, 10, 10, 10, 10, 10, 20], not_sure_pct: 20, n: 50 }]}
                scaleLabels={eightPoint.map((p) => p.label)}
                scale={eightPoint}
                hasNotSure
            />,
        );

        expect(container.querySelectorAll('[data-testid="likert-segment"]')).toHaveLength(7);
        const badges = container.querySelectorAll('[data-testid="likert-not-sure"]');
        expect(badges).toHaveLength(1);
        expect(badges[0].textContent).toBe('20%');
        expect(badges[0].querySelector('rect')?.getAttribute('fill')?.toUpperCase()).toBe('#EFE7FA');
        expect(badges[0].querySelector('rect')?.getAttribute('stroke')?.toUpperCase()).toBe('#B9A6E0');
        expect(getByText('NOT SURE')).toBeTruthy();
        expect(getByTestId('likert-legend-not-sure')).toBeTruthy();
    });

    it('keeps Not sure clear of the bars and the count', () => {
        const { container } = render(
            <LikertChart
                data={[{ label: 'Row', pcts: [100, 0, 0, 0, 0, 0, 0], not_sure_pct: 0, n: 5 }]}
                scaleLabels={eightPoint.map((p) => p.label)}
                scale={eightPoint}
                hasNotSure
            />,
        );

        const badge = container.querySelector('[data-testid="likert-not-sure"] rect');
        const badgeLeft = Number(badge?.getAttribute('x'));
        const badgeRight = badgeLeft + Number(badge?.getAttribute('width'));
        // Only the 100% segment is drawn; its path is `M{x+r},0 h{w-r} ...`, so its right edge is the two summed.
        const d = container.querySelector('[data-testid="likert-segment"]')?.getAttribute('d') ?? '';
        const [, start, run] = d.match(/^M([\d.]+),[\d.]+ h([\d.]+)/) ?? [];
        const barRight = Number(start) + Number(run);
        const countX = Number(Array.from(container.querySelectorAll('svg text')).find((t) => t.textContent === 'COUNT')?.getAttribute('x'));
        expect(badgeLeft).toBeGreaterThan(barRight);
        expect(badgeRight).toBeLessThan(countX);
    });

    it('has no Not sure column or legend entry when the scale has none', () => {
        const { container, queryByText, queryByTestId } = render(
            <LikertChart data={[{ label: 'Row', pcts, not_sure_pct: null, n: 10 }]} />,
        );

        expect(container.querySelector('[data-testid="likert-not-sure"]')).toBeNull();
        expect(queryByText('NOT SURE')).toBeNull();
        expect(queryByTestId('likert-legend-not-sure')).toBeNull();
    });
});

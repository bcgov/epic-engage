import { act, render } from '@testing-library/react';
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

    const paths = (container: HTMLElement) =>
        Array.from(container.querySelectorAll('[data-testid="likert-segment"]')).map((p) => p.getAttribute('d') ?? '');
    // The outline runs clockwise, so right-side corners move down (dy > 0) and left-side ones move up.
    const roundsRight = (d: string) => /a[\d.]+,[\d.]+ 0 0 1 -?[\d.]+,[\d.]+/.test(d);
    const roundsLeft = (d: string) => /a[\d.]+,[\d.]+ 0 0 1 -?[\d.]+,-[\d.]+/.test(d);

    it('rounds the ends of the drawn bar even when the end categories are 0%', () => {
        const { container } = render(<LikertChart data={[{ label: 'Row', pcts: [0, 40, 20, 40, 0], n: 10 }]} />);

        const [first, middle, last] = paths(container);
        expect([roundsLeft(first), roundsRight(first)]).toEqual([true, false]);
        expect([roundsLeft(middle), roundsRight(middle)]).toEqual([false, false]);
        expect([roundsLeft(last), roundsRight(last)]).toEqual([false, true]);
    });

    it.each([
        [100, 0, 0, 0, 0],
        [0, 0, 100, 0, 0],
        [0, 0, 0, 100, 0],
        [0, 0, 0, 0, 100],
    ])('rounds both ends of a bar with a single drawn segment (%j)', (...values) => {
        const { container } = render(<LikertChart data={[{ label: 'Row', pcts: values, n: 10 }]} />);

        const [only] = paths(container);
        expect([roundsLeft(only), roundsRight(only)]).toEqual([true, true]);
    });

    it('keeps each segment border inside the bar so no edge is clipped', () => {
        const { container } = render(<LikertChart data={[{ label: 'Row', pcts, n: 10 }]} />);

        paths(container).forEach((d) => {
            // Starts half a border below the top of the bar, not on it.
            expect(d).toMatch(/^M[\d.]+,0\.5 /);
            // Vertical runs total the bar height minus a full border.
            const runs = Array.from(d.matchAll(/v(-?[\d.]+)/g)).map((m) => Number(m[1]));
            const arcs = Array.from(d.matchAll(/a[\d.]+,[\d.]+ 0 0 1 -?[\d.]+,(-?[\d.]+)/g)).map((m) => Number(m[1]));
            const down = [...runs, ...arcs].filter((n) => n > 0).reduce((a, b) => a + b, 0);
            expect(down).toBeCloseTo(23, 5);
        });
    });

    // Walk the outline to measure its actual bounds, including corners rather than just its first h run.
    const bounds = (d: string) => {
        let x = 0;
        let y = 0;
        const xs: number[] = [];
        const ys: number[] = [];
        for (const [, command, args] of d.matchAll(/([Mhvaz])([^Mhvaz]*)/g)) {
            const values = args.trim().split(/[ ,]+/).map(Number);
            if (command === 'M') [x, y] = values;
            if (command === 'h') x += values[0];
            if (command === 'v') y += values[0];
            if (command === 'a') {
                x += values[5];
                y += values[6];
            }
            xs.push(x);
            ys.push(y);
        }
        return { left: Math.min(...xs) - 0.5, right: Math.max(...xs) + 0.5,
            top: Math.min(...ys) - 0.5, bottom: Math.max(...ys) + 0.5 };
    };

    it('keeps borders on pixels and adjacent segments touching after fractional resizes', () => {
        let resize: ResizeObserverCallback;
        const observer = jest.spyOn(global, 'ResizeObserver').mockImplementation((callback) => {
            resize = callback;
            return { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() };
        });
        try {
            const { container } = render(<LikertChart data={[{ label: 'Row', pcts: [17, 16, 33, 17, 17], n: 100 }]} />);
            for (const width of [700, 763.375, 801.625]) {
                act(() => resize([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver));
                const svg = container.querySelector('svg');
                expect(Number(svg?.getAttribute('width'))).toBe(Math.floor(width));
                const edges = paths(container).map(bounds);
                edges.forEach((edge, i) => {
                    expect(Number.isInteger(edge.left)).toBe(true);
                    expect(Number.isInteger(edge.right)).toBe(true);
                    expect(edge.top).toBe(0);
                    expect(edge.bottom).toBe(24);
                    if (i > 0) expect(edge.left).toBe(edges[i - 1].right);
                });
                expect(edges[0].left).toBe(BAR_LEFT);
                expect(edges[edges.length - 1].right).toBe(Math.floor(width) - 102);
            }
        } finally {
            observer.mockRestore();
        }
    });

    it('aligns the SVG origin when the surrounding layout starts between pixels', () => {
        const rect = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            left: 20.375, top: 111.4375,
        } as DOMRect);
        try {
            const { container } = render(<LikertChart data={[{ label: 'Row', pcts, n: 10 }]} />);
            expect(container.querySelector('svg')?.style.left).toBe('-0.375px');
            expect(container.querySelector('svg')?.style.top).toBe('-0.4375px');
        } finally {
            rect.mockRestore();
        }
    });

    it('never draws wider than its container, so no scrollbar appears', () => {
        let resize: ResizeObserverCallback;
        const observer = jest.spyOn(global, 'ResizeObserver').mockImplementation((callback) => {
            resize = callback;
            return { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() };
        });
        // Origin snaps right by 0.375px.
        const rect = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            left: 20.625, top: 111.5625,
        } as DOMRect);
        try {
            const { container } = render(<LikertChart data={[{ label: 'Row', pcts, n: 10 }]} />);
            for (const width of [700, 812.6, 812.8]) {
                act(() => resize([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver));
                const svg = container.querySelector('svg') as SVGSVGElement;
                expect(parseFloat(svg.style.left) + Number(svg.getAttribute('width'))).toBeLessThanOrEqual(width);
                expect(svg.parentElement && getComputedStyle(svg.parentElement).overflowX).not.toBe('auto');
            }
        } finally {
            rect.mockRestore();
            observer.mockRestore();
        }
    });

    it('assigns corners after subpixel end categories disappear', () => {
        const { container } = render(<LikertChart data={[{ label: 'Row', pcts: [0.01, 40, 19.98, 40, 0.01], n: 10000 }]} />);
        const [first, middle, last] = paths(container);
        expect(paths(container)).toHaveLength(3);
        expect([roundsLeft(first), roundsRight(first)]).toEqual([true, false]);
        expect([roundsLeft(middle), roundsRight(middle)]).toEqual([false, false]);
        expect([roundsLeft(last), roundsRight(last)]).toEqual([false, true]);
    });

    it('keeps the centre guide clear of a lone segment and its rounded corners', () => {
        const { container } = render(<LikertChart data={[{ label: 'Row', pcts: [0, 0, 0, 100, 0], n: 10 }]} />);
        const segment = container.querySelector('[data-testid="likert-segment"]');
        const barY = Number(segment?.parentElement?.parentElement?.getAttribute('transform')?.match(/, ([\d.]+)/)?.[1]);
        const axis = container.querySelector('[data-testid="likert-axis"]');
        const guides = Array.from(axis?.parentElement?.querySelectorAll('line') ?? []);
        expect(guides).toHaveLength(2);
        for (const guide of guides) {
            expect(Number(guide.getAttribute('y2')) < barY || Number(guide.getAttribute('y1')) > barY + 24).toBe(true);
        }
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
        // The negative segment's path starts at its left edge; the positive one starts at the axis,
        // inset by half its 1px border.
        const startX = (p: Element) => Number((p.getAttribute('d') ?? '').match(/^M([\d.]+)/)?.[1]);
        expect(startX(pos)).toBeCloseTo(axisX + 0.5, 5);
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
        const badge = badges[0].querySelector('rect');
        expect(Number(badge?.getAttribute('x')) % 1).toBe(0.5);
        expect(Number(badge?.getAttribute('y')) % 1).toBe(0.5);
        expect(Number(badge?.getAttribute('height'))).toBe(23);
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
        // Include the curved right end and its stroke when measuring the bar.
        const d = container.querySelector('[data-testid="likert-segment"]')?.getAttribute('d') ?? '';
        const barRight = bounds(d).right;
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

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DonutChart } from 'components/public/dashboard/charts/DonutChart';
import { CheckboxChart } from 'components/public/dashboard/charts/CheckboxChart';
import { LikertChart } from 'components/public/dashboard/charts/LikertChart';
import { RankOrderChart } from 'components/public/dashboard/charts/RankOrderChart';
import { flatToChartItems } from 'components/public/dashboard/SurveyResultsCharts';

// Survey option order, deliberately not in descending-percentage order so a magnitude sort
// would be visible in the rendered output.
const ageRanges = [
    { label: '14-18', pct: 10, count: 10 },
    { label: '19-34', pct: 50, count: 50 },
    { label: '35-54', pct: 15, count: 15 },
    { label: '55+', pct: 25, count: 25 },
];

const labelsInOrder = (container: HTMLElement, selector: string) =>
    Array.from(container.querySelectorAll(selector)).map((el) => el.textContent);

// LikertChart measures its wrapper before drawing the SVG, and jsdom reports every element as
// zero-width, so the chart body would never render without a stubbed width.
const CHART_WIDTH = 700;
let clientWidthSpy: jest.SpyInstance;

beforeAll(() => {
    global.ResizeObserver = class {
        observe() {
            /* no-op: width comes from the clientWidth stub below */
        }
        unobserve() {
            /* no-op */
        }
        disconnect() {
            /* no-op */
        }
    };
    clientWidthSpy = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(CHART_WIDTH);
});

afterAll(() => {
    clientWidthSpy.mockRestore();
});

describe('DonutChart', () => {
    it('renders legend rows in survey option order, not by percentage', () => {
        render(<DonutChart data={ageRanges} total={100} />);

        ageRanges.forEach((item) => {
            expect(screen.getByText(item.label)).toBeInTheDocument();
        });

        const rendered = screen.getAllByText(/^(14-18|19-34|35-54|55\+)$/).map((el) => el.textContent);
        expect(rendered).toEqual(['14-18', '19-34', '35-54', '55+']);
    });

    it('bolds the largest response wherever it sits in survey order', () => {
        render(<DonutChart data={ageRanges} total={100} />);

        expect(screen.getByText('19-34')).toHaveStyle('font-weight: 700');
        expect(screen.getByText('14-18')).toHaveStyle('font-weight: 400');
    });

    it('shows the respondent count in the centre of the donut', () => {
        render(<DonutChart data={ageRanges} total={1234} />);

        expect(screen.getByText('1,234')).toBeInTheDocument();
        expect(screen.getByText('respondents')).toBeInTheDocument();
    });
});

describe('CheckboxChart', () => {
    it('renders rows in survey option order', () => {
        render(<CheckboxChart question="Which apply?" respondentCount={100} data={ageRanges} />);

        const rendered = screen.getAllByText(/^(14-18|19-34|35-54|55\+)$/).map((el) => el.textContent);
        expect(rendered).toEqual(['14-18', '19-34', '35-54', '55+']);
    });

    it('labels all three columns', () => {
        render(<CheckboxChart question="Which apply?" respondentCount={100} data={ageRanges} />);

        expect(screen.getByText('Response')).toBeInTheDocument();
        expect(screen.getByText('% of Respondents')).toBeInTheDocument();
        expect(screen.getByText('Count')).toBeInTheDocument();
    });
});

describe('LikertChart', () => {
    // Five scale points running negative -> neutral -> positive, as every scale in the design does.
    const rows = [
        { label: 'Cost', pcts: [40, 20, 20, 10, 10], n: 100 },
        { label: 'Speed', pcts: [10, 10, 20, 30, 30], n: 100 },
    ];
    const axisLabels: [string, string] = ['Not effective', 'Effective'];

    it('renders rows in survey order rather than by net favourability', () => {
        const { container } = render(<LikertChart data={rows} axisLabels={axisLabels} />);

        const rowLabels = labelsInOrder(container, 'svg g > text').filter((t) => t === 'Cost' || t === 'Speed');
        expect(rowLabels).toEqual(['Cost', 'Speed']);
    });

    it('renders one legend entry per scale point', () => {
        render(<LikertChart data={rows} axisLabels={axisLabels} />);

        ['Not effective', 'Neutral', 'Somewhat effective', 'Effective', 'Very effective'].forEach((label) => {
            expect(screen.getByText(label)).toBeInTheDocument();
        });
    });

    it('pivots each bar on the middle of its neutral segment', () => {
        const { container } = render(
            <LikertChart data={[{ label: 'Cost', pcts: [20, 20, 20, 20, 20], n: 100 }]} axisLabels={axisLabels} />,
        );

        const axisX = Number((container.querySelector('line[stroke-dasharray]') as SVGLineElement).getAttribute('x1'));
        const [, start, width] =
            /^M([\d.]+),0 h(-?[\d.]+)/.exec(
                container.querySelectorAll('svg path')[1].getAttribute('d') ?? '',
            ) ?? [];
        // Half the neutral band falls either side of the axis, so a row leans by its overhang.
        expect(Number(start) + Number(width) / 2).toBeCloseTo(axisX, 5);
    });

    const axisHeader = (container: HTMLElement) =>
        Array.from(container.querySelectorAll('svg > text'))
            .map((t) => t.textContent ?? '')
            .find((t) => t.includes('|'));

    it('names the axis after the two ends of the scale it was given', () => {
        const { container } = render(
            <LikertChart
                data={rows}
                scaleLabels={['Not concerned', 'Neutral', 'Somewhat concerned', 'Concerned', 'Very concerned']}
            />,
        );

        expect(axisHeader(container)?.replace(/\s+/g, ' ')).toBe('← NOT CONCERNED | VERY CONCERNED →');
    });

    it('keeps the axis and the legend describing the same scale when none was supplied', () => {
        // Deriving the axis outside the chart used to pair a "Negative/Positive" axis with the
        // chart's own "Not effective..Very effective" legend defaults.
        const { container } = render(<LikertChart data={rows} />);

        expect(screen.getByText('Not effective')).toBeInTheDocument();
        expect(screen.getByText('Very effective')).toBeInTheDocument();
        expect(axisHeader(container)?.replace(/\s+/g, ' ')).toBe('← NOT EFFECTIVE | VERY EFFECTIVE →');
    });

    it('adapts to a scale length other than the default', () => {
        const fourPoint = [{ label: 'Cost', pcts: [25, 25, 25, 25], n: 50 }];
        const { container } = render(
            <LikertChart data={fourPoint} axisLabels={axisLabels} scaleLabels={['One', 'Two', 'Three', 'Four']} />,
        );

        ['One', 'Two', 'Three', 'Four'].forEach((label) => {
            expect(screen.getByText(label)).toBeInTheDocument();
        });
        expect(container.querySelectorAll('svg path')).toHaveLength(4);
    });

    it('keeps every bar inside the bar column and centres the scale header over it', () => {
        // Lopsided rows: the widest negative segment and the widest positive run come from
        // different rows, which is what used to push bars past the right edge.
        const lopsided = [
            { label: 'Cost', pcts: [50, 30, 10, 5, 5], n: 100 },
            { label: 'Speed', pcts: [5, 5, 20, 30, 40], n: 100 },
        ];
        const { container } = render(<LikertChart data={lopsided} axisLabels={axisLabels} />);

        const clip = container.querySelector('clipPath rect') as SVGRectElement;
        const colLeft = Number(clip.getAttribute('x'));
        const colWidth = Number(clip.getAttribute('width'));
        const colRight = colLeft + colWidth;

        // Each segment path starts `M<x>,0 h<width>`, so start + width is its right edge.
        const edges = Array.from(container.querySelectorAll('svg path')).map((path) => {
            const [, x, w] = /^M([\d.]+),0 h(-?[\d.]+)/.exec(path.getAttribute('d') ?? '') ?? [];
            return { start: Number(x), end: Number(x) + Number(w) };
        });
        expect(edges.length).toBe(lopsided.length * 5);
        edges.forEach(({ start, end }) => {
            expect(start).toBeGreaterThanOrEqual(colLeft);
            expect(end).toBeLessThanOrEqual(colRight);
        });

        const header = Array.from(container.querySelectorAll('svg > text')).find((t) =>
            t.textContent?.includes('EFFECTIVE'),
        ) as SVGTextElement;
        expect(header.getAttribute('text-anchor')).toBe('middle');
        expect(Number(header.getAttribute('x'))).toBeCloseTo(colLeft + colWidth / 2, 5);
    });

    it('renders the column headers from the acceptance criteria', () => {
        const { container } = render(<LikertChart data={rows} axisLabels={['Least important', 'Most important']} />);

        const headers = labelsInOrder(container, 'svg text');
        expect(headers).toContain('RESPONSE');
        expect(headers).toContain('COUNT');
        expect(headers.map((h) => h?.replace(/\s+/g, ' '))).toContain('← LEAST IMPORTANT | MOST IMPORTANT →');
    });
});

describe('RankOrderChart', () => {
    // Ranked 2nd by weighted score, 1st, then 3rd - so render order and placement disagree.
    const data = [
        { label: 'Parks', ranks: [20, 80, 0] },
        { label: 'Transit', ranks: [70, 30, 0] },
        { label: 'Housing', ranks: [10, 10, 80] },
    ];

    it('renders rows in survey order', () => {
        render(<RankOrderChart data={data} />);

        const rendered = screen.getAllByText(/^(Parks|Transit|Housing)$/).map((el) => el.textContent);
        expect(rendered).toEqual(['Parks', 'Transit', 'Housing']);
    });

    it('numbers each row by weighted-score placement, not render position', () => {
        render(<RankOrderChart data={data} />);

        // Placement medals appear alongside their labels: Parks 2nd, Transit 1st, Housing 3rd.
        const rowFor = (label: string) =>
            screen.getByText(label).closest('div')?.parentElement?.parentElement as HTMLElement;
        const parksRow = rowFor('Parks');
        const transitRow = rowFor('Transit');
        const housingRow = rowFor('Housing');

        expect(within(parksRow).getByText('2')).toBeInTheDocument();
        expect(within(transitRow).getByText('1')).toBeInTheDocument();
        expect(within(housingRow).getByText('3')).toBeInTheDocument();
    });

    it('labels the legend by rank position, limited to the number of options', () => {
        render(<RankOrderChart data={data} />);

        expect(screen.getByText('Ranked:')).toBeInTheDocument();
        ['1st', '2nd', '3rd'].forEach((label) => {
            expect(screen.getByText(label)).toBeInTheDocument();
        });
        expect(screen.queryByText('4th')).not.toBeInTheDocument();
    });
});

describe('flatToChartItems', () => {
    const ticks = [
        { value: 'Cycling', count: 60 },
        { value: 'Walking', count: 60 },
    ];

    it('measures single-select options against all responses so they total 100%', () => {
        const { data, total } = flatToChartItems(ticks);

        expect(total).toBe(120);
        expect(data.map((d) => d.pct)).toEqual([50, 50]);
    });

    it('measures multi-select options against the respondent count, not the tick count', () => {
        // 80 people cast 120 ticks; 60 of them picked cycling, so that is 75% of people.
        const { data, total } = flatToChartItems(ticks, 80);

        expect(total).toBe(120);
        expect(data.map((d) => d.pct)).toEqual([75, 75]);
    });

    it('falls back to the response total when no respondent count is available', () => {
        expect(flatToChartItems(ticks, undefined).data.map((d) => d.pct)).toEqual([50, 50]);
        expect(flatToChartItems(ticks, 0).data.map((d) => d.pct)).toEqual([50, 50]);
    });
});

describe('CheckboxChart respondent count', () => {
    it('drops the count from the summary when the backend reports none', () => {
        render(<CheckboxChart question="Which apply?" data={ageRanges} />);

        expect(screen.getByText(/Multiple selections allowed/)).toBeInTheDocument();
        expect(screen.queryByText(/respondents/)).not.toBeInTheDocument();
    });
});

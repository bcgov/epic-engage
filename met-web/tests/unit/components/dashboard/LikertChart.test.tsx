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
});

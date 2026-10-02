import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChartsPngExport } from 'components/public/dashboard/ChartsPngExport';
import { TypedSurveyData } from 'models/analytics/surveyResult';

jest.mock('html-to-image', () => ({ toPng: jest.fn(() => Promise.resolve('data:image/png;base64,AAAA')) }));
jest.mock('@zip.js/zip.js', () => ({ ZipWriter: jest.fn() }));
jest.mock('components/public/dashboard/charts', () => ({
    DonutChart: () => <div data-testid="donut-chart" />,
    ConditionalFollowUp: () => null,
}));

const chart: TypedSurveyData = {
    label: 'What is your age?',
    position: 0,
    key: 'age',
    type: 'simpleradios',
    result: [{ value: '18-24', count: 2 }],
};

describe('ChartsPngExport', () => {
    beforeAll(() => {
        // jsdom has no font loading API.
        Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true });
    });

    it('saves a single chart as a lone PNG under the given name, without zipping it', async () => {
        const downloads: { href: string; download: string }[] = [];
        const click = jest
            .spyOn(HTMLAnchorElement.prototype, 'click')
            .mockImplementation(function (this: HTMLAnchorElement) {
                downloads.push({ href: this.href, download: this.download });
            });
        const onDone = jest.fn();

        render(
            <ChartsPngExport
                engagementName="Ranch"
                charts={[chart]}
                descriptions={{}}
                fileName="Ranch_Whatisyourage.png"
                onDone={onDone}
            />,
        );

        await waitFor(() => expect(onDone).toHaveBeenCalledWith());
        expect(downloads).toEqual([{ href: 'data:image/png;base64,AAAA', download: 'Ranch_Whatisyourage.png' }]);
        expect(jest.requireMock('@zip.js/zip.js').ZipWriter).not.toHaveBeenCalled();
        click.mockRestore();
    });

    // StrictMode mounts, unmounts and remounts in development; only the surviving mount may save.
    it('saves the PNG once under StrictMode', async () => {
        const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
        const onDone = jest.fn();

        render(
            <React.StrictMode>
                <ChartsPngExport
                    engagementName="Ranch"
                    charts={[chart]}
                    descriptions={{}}
                    fileName="Ranch_Whatisyourage.png"
                    onDone={onDone}
                />
            </React.StrictMode>,
        );

        await waitFor(() => expect(onDone).toHaveBeenCalled());
        // Give the cancelled first run time to finish its capture too.
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(click).toHaveBeenCalledTimes(1);
        expect(onDone).toHaveBeenCalledTimes(1);
        click.mockRestore();
    });
});

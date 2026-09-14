import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ResultsAsOfWatermark } from 'components/public/dashboard/ResultsAsOfWatermark';
import { SubmissionStatus } from 'constants/engagementStatus';
import { DashboardType } from 'constants/dashboardType';

const dataAsOf = new Date('2026-03-18T21:47:00Z');

const renderWatermark = (props: Partial<React.ComponentProps<typeof ResultsAsOfWatermark>> = {}) =>
    render(
        <ResultsAsOfWatermark
            submissionStatus={SubmissionStatus.Open}
            dashboardType={DashboardType.PUBLIC}
            dataAsOf={dataAsOf}
            {...props}
        />,
    );

describe('ResultsAsOfWatermark', () => {
    it('stamps the public dashboard with the B.C. local time the data was read', () => {
        renderWatermark();

        expect(screen.getByText('Results as of')).toBeInTheDocument();
        expect(screen.getByText('Mar 18, 2026, 2:47 PM (PT)')).toBeInTheDocument();
        expect(screen.getByText('Survey is open - results are subject to change')).toBeInTheDocument();
    });

    it('reads the time in B.C. rather than the reader’s own timezone', () => {
        renderWatermark({ dataAsOf: new Date('2026-01-18T22:47:00Z') });

        expect(screen.getByText('Jan 18, 2026, 2:47 PM (PT)')).toBeInTheDocument();
    });

    it('says nothing once the engagement has closed, since the numbers stop moving', () => {
        renderWatermark({ submissionStatus: SubmissionStatus.Closed });

        expect(screen.queryByText('Results as of')).not.toBeInTheDocument();
    });

    it('says nothing on an engagement that has not opened yet', () => {
        renderWatermark({ submissionStatus: SubmissionStatus.Upcoming });

        expect(screen.queryByText('Results as of')).not.toBeInTheDocument();
    });

    it('is a public-dashboard stamp only', () => {
        renderWatermark({ dashboardType: DashboardType.INTERNAL });

        expect(screen.queryByText('Results as of')).not.toBeInTheDocument();
    });

    it('waits for the data before claiming a time', () => {
        renderWatermark({ dataAsOf: null });

        expect(screen.queryByText('Results as of')).not.toBeInTheDocument();
    });
});

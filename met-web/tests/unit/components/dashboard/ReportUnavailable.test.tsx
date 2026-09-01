import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReportUnavailable } from 'components/public/dashboard/ReportUnavailable';
import { UNAVAILABLE_REASON } from 'components/public/dashboard/reportAvailability';

const mockRoles: string[] = [];

jest.mock('hooks', () => ({
    ...jest.requireActual('hooks'),
    useAppSelector: jest.fn((selector) => selector({ user: { roles: mockRoles } })),
}));

describe('ReportUnavailable', () => {
    beforeEach(() => {
        mockRoles.length = 0;
    });

    it('tells any visitor the report is not available, without naming an admin setting', () => {
        render(<ReportUnavailable reason={UNAVAILABLE_REASON.SEND_REPORT_OFF} />);

        expect(screen.getByText(/This report isn't available/i)).toBeInTheDocument();
        expect(screen.getByText(/has not been made public/i)).toBeInTheDocument();
        expect(screen.queryByTestId('report-unavailable-staff-guidance')).not.toBeInTheDocument();
    });

    it('tells staff which setting is holding the report back', () => {
        mockRoles.push('access_dashboard');

        render(<ReportUnavailable reason={UNAVAILABLE_REASON.SEND_REPORT_OFF} />);

        expect(screen.getByTestId('report-unavailable-staff-guidance')).toHaveTextContent(
            "Turn on Send Report under the engagement's Settings tab to make this report public.",
        );
    });

    it('points staff at publishing the engagement when that is what is holding the report back', () => {
        mockRoles.push('access_dashboard');

        render(<ReportUnavailable reason={UNAVAILABLE_REASON.ENGAGEMENT_UNPUBLISHED} />);

        expect(screen.getByTestId('report-unavailable-staff-guidance')).toHaveTextContent(
            'Publish this engagement again to make this report public.',
        );
    });

    // The API withheld the report for a reason this build doesn't know about - the reader still
    // gets a straight answer instead of an empty report.
    it('still says the report is unavailable when the reason is unrecognised', () => {
        mockRoles.push('access_dashboard');

        render(<ReportUnavailable reason={UNAVAILABLE_REASON.UNKNOWN} />);

        expect(screen.getByText(/This report isn't available/i)).toBeInTheDocument();
        expect(screen.queryByTestId('report-unavailable-staff-guidance')).not.toBeInTheDocument();
    });
});

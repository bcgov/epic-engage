import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from 'redux/store';
import Dashboard from 'components/public/dashboard/Dashboard';
import { DashboardContext } from 'components/public/dashboard/DashboardContext';
import { SubmissionStatus } from 'constants/engagementStatus';
import { openEngagement } from '../factory';

jest.mock('components/public/dashboard/SurveyResultsCharts', () => ({
    __esModule: true,
    SurveyResultsCharts: () => <div data-testid="survey-results-charts" />,
}));

jest.mock('components/public/dashboard/comments/CommentsTab', () => ({
    __esModule: true,
    CommentsTab: () => <div data-testid="comments-tab" />,
}));

jest.mock('services/analytics/aggregatorService', () => ({
    getAggregatorData: jest.fn(() => Promise.resolve({ value: 42 })),
}));
jest.mock('services/analytics/mapService', () => ({
    getMapData: jest.fn(() => Promise.resolve({ marker_label: 'Victoria' })),
}));
jest.mock('services/analytics/userResponseDetailService', () => ({
    getUserResponseDetailByMonth: jest.fn(() => Promise.resolve([])),
}));

const renderDashboard = (submissionStatus: SubmissionStatus) =>
    render(
        <Provider store={store}>
            <MemoryRouter initialEntries={['/']}>
                <DashboardContext.Provider
                    value={{
                        engagement: { ...openEngagement, submission_status: submissionStatus },
                        isEngagementLoading: false,
                        dashboardType: 'public',
                        originSurvey: null,
                    }}
                >
                    <Dashboard />
                </DashboardContext.Provider>
            </MemoryRouter>
        </Provider>,
    );

describe('Public dashboard "results as of" stamp', () => {
    it('stays visible when the reader switches from Survey Results to Comments', async () => {
        renderDashboard(SubmissionStatus.Open);

        expect(await screen.findByText('Results as of')).toBeInTheDocument();
        expect(screen.getByText('Survey is open - results are subject to change')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: /comments/i }));

        expect(screen.getByTestId('comments-tab')).toBeInTheDocument();
        expect(screen.getByText('Results as of')).toBeInTheDocument();
    });

    it('is absent from a closed engagement, whose results no longer change', async () => {
        renderDashboard(SubmissionStatus.Closed);

        await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
        expect(screen.queryByText('Results as of')).not.toBeInTheDocument();
    });
});

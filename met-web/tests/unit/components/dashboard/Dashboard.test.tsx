import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from 'redux/store';
import Dashboard from 'components/public/dashboard/Dashboard';
import { DashboardContext } from 'components/public/dashboard/DashboardContext';
import { Survey } from 'models/survey';
import { openEngagement } from '../factory';

const originSurvey = openEngagement.surveys[0];

jest.mock('components/public/dashboard/SurveyResultsCharts', () => ({
    __esModule: true,
    SurveyResultsCharts: () => <div data-testid="survey-results-charts" />,
}));

jest.mock('components/public/dashboard/comments/CommentsTab', () => ({
    __esModule: true,
    CommentsTab: () => <div data-testid="comments-tab" />,
}));

// DashboardHeaderCard reads auth state and roles from the store to decide whether to offer the
// internal export, so Dashboard cannot render without one. The default store state is signed out
// with no roles, which is what this test wants: the export button stays hidden either way.
const renderDashboard = (originSurveyValue: Survey | null = null) =>
    render(
        <Provider store={store}>
            <MemoryRouter>
                <DashboardContext.Provider
                    value={{
                        engagement: openEngagement,
                        isEngagementLoading: false,
                        dashboardType: 'public',
                        originSurvey: originSurveyValue,
                    }}
                >
                    <Dashboard />
                </DashboardContext.Provider>
            </MemoryRouter>
        </Provider>,
    );

describe('Dashboard', () => {
    it('renders the breadcrumb with the engagement name and shows the Survey Results tab by default', () => {
        renderDashboard();

        expect(screen.getByText(openEngagement.name)).toBeInTheDocument();
        expect(screen.getByText('Public Report')).toBeInTheDocument();
        expect(screen.getByTestId('survey-results-charts')).toBeInTheDocument();
    });

    // Signed out, the landing page is the visitor's engagement browser;
    // /engagements is a staff-only route.
    it('points the Engagements crumb at the landing page for signed-out visitors', () => {
        renderDashboard();

        expect(screen.getByRole('link', { name: 'Engagements' })).toHaveAttribute('href', '/');
    });

    it('retraces the Surveys listing when the report was opened from a survey', () => {
        renderDashboard(originSurvey);

        expect(screen.getByRole('link', { name: 'Surveys' })).toHaveAttribute('href', '/surveys');
        expect(screen.getByRole('link', { name: originSurvey.name })).toHaveAttribute(
            'href',
            `/surveys/${originSurvey.id}/submit`,
        );
        expect(screen.queryByRole('link', { name: 'Engagements' })).not.toBeInTheDocument();
        expect(screen.getByText('Public Report')).toBeInTheDocument();
    });

    it('does not mount the Comments tab until the user visits it', () => {
        renderDashboard();
        expect(screen.queryByTestId('comments-tab')).not.toBeInTheDocument();
    });

    it('mounts the Comments tab once selected, and keeps it mounted (hidden) after switching back', () => {
        renderDashboard();

        fireEvent.click(screen.getByRole('tab', { name: /comments/i }));
        expect(screen.getByTestId('comments-tab')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: /survey results/i }));
        // Comments tab content stays in the DOM (hidden via display:none) rather than unmounting,
        // so its scroll position/state survives switching back and forth.
        expect(screen.getByTestId('comments-tab')).toBeInTheDocument();
        expect(screen.getByTestId('survey-results-charts')).toBeInTheDocument();
    });
});

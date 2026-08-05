import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import React, { ReactNode } from 'react';
import '@testing-library/jest-dom';
import Dashboard from 'components/admin/dashboard';
import { setupEnv } from '../setEnvVars';
import * as reactRedux from 'react-redux';
import * as engagementService from 'services/engagementService';
import * as aggregatorService from 'services/analytics/aggregatorService';
import * as userResponseDetailService from 'services/analytics/userResponseDetailService';
import * as surveyResultService from 'services/analytics/surveyResult';
import * as notificationSlice from 'services/notificationService/notificationSlice';
import { openEngagement, closedEngagement } from '../factory';

jest.mock('@mui/material', () => ({
    ...jest.requireActual('@mui/material'),
    Link: ({ children }: { children: ReactNode }) => {
        return <a>{children}</a>;
    },
}));

jest.mock('axios')

jest.mock('components/shared/common', () => ({
    ...jest.requireActual('components/shared/common'),
    PrimaryButton: ({ children, ...rest }: { children: ReactNode;[prop: string]: unknown }) => {
        return <button {...rest}>{children}</button>;
    },
}));

jest.mock('maplibre-gl/dist/maplibre-gl', () => ({
    Map: () => ({}),
}));

jest.mock('@mui/material', () => ({
    ...jest.requireActual('@mui/material'),
    useMediaQuery: jest.fn(() => true),
}));

describe('Dashboard page tests', () => {
    jest.spyOn(reactRedux, 'useDispatch').mockImplementation(() => jest.fn());
    jest.spyOn(notificationSlice, 'openNotification').mockImplementation(jest.fn());
    const getEngagementMock = jest.spyOn(engagementService, 'getEngagements').mockReturnValue(Promise.resolve({ items: [], total: 0 }));
    const getAggregatorMock = jest.spyOn(aggregatorService, 'getAggregatorData');
    const getUserResponseDetailByMonthMock = jest.spyOn(userResponseDetailService, 'getUserResponseDetailByMonth');
    const getSurveyResultDataMock = jest.spyOn(surveyResultService, 'getSurveyResultData');

    beforeEach(() => {
        setupEnv();
    });

    test('Dashboard is rendered and engagements are fetched', async () => {
        getEngagementMock.mockReturnValueOnce(
            Promise.resolve({
                items: [openEngagement, closedEngagement],
                total: 2,
            }),
        );
        render(<Dashboard />);

        await waitFor(() => {
            expect(screen.getByText('Open Engagement')).toBeInTheDocument();
            expect(screen.getByText('Closed Engagement')).toBeInTheDocument();
        });
        await waitFor(() => {});
    });

    test('Accordion expands and dashboard is displayed', async () => {
        getEngagementMock.mockReturnValueOnce(
            Promise.resolve({
                items: [closedEngagement, openEngagement],
                total: 1,
            }),
        );
        getAggregatorMock.mockReturnValueOnce(
            Promise.resolve({
                key: '',
                value: 0,
            }),
        );
        getUserResponseDetailByMonthMock.mockReturnValueOnce(
            Promise.resolve({
                showdataby: '',
                responses: 0,
            }),
        );
        getSurveyResultDataMock.mockReturnValueOnce(
            Promise.resolve({
                data: [
                    {
                        label: '',
                        position: 0,
                        result: [{ value: '', count: 0 }],
                    },
                ],
            }),
        );
        render(<Dashboard />);

        await waitFor(() => {
            expect(screen.getByText('Open Engagement')).toBeInTheDocument();
        });

        const accordion = screen.getByTestId(`engagement-accordion-${openEngagement.id}`);
        expect(accordion).toBeVisible();

        fireEvent.click(accordion);
        expect(screen.getByTestId(`dashboard-frame-${openEngagement.id}`)).toBeVisible();

        await waitFor(() => {});
    });

    test('Empty state shows "No Engagements Found" message', async () => {
        getEngagementMock.mockReturnValue(
            Promise.resolve({
                items: [],
                total: 0,
            }),
        );

        render(<Dashboard />);

        await waitFor(() => {
            // When all accordions are empty, they should show "No Engagements Found"
            const noEngagementsMessages = screen.getAllByText('No Engagements Found');
            expect(noEngagementsMessages.length).toBeGreaterThan(0);
        });
    });

    test('Handles API error gracefully and shows notification', async () => {
        const openNotificationMock = jest.spyOn(notificationSlice, 'openNotification');
        getEngagementMock.mockRejectedValueOnce(new Error('API Error'));

        render(<Dashboard />);

        await waitFor(() => {
            expect(openNotificationMock).toHaveBeenCalled();
        });
    });

    test('Recently closed engagements (within 30 days) are displayed in correct section', async () => {
        // Create a recently closed engagement (within last 30 days)
        const today = new Date();
        const recentlyClosedDate = new Date(today);
        recentlyClosedDate.setDate(today.getDate() - 15); // 15 days ago

        const recentlyClosedEngagement = {
            ...closedEngagement,
            id: 10,
            name: 'Recently Closed Engagement',
            end_date: recentlyClosedDate.toISOString().split('T')[0],
        };

        getEngagementMock
            .mockReturnValueOnce(Promise.resolve({ items: [], total: 0 }))          // Open
            .mockReturnValueOnce(Promise.resolve({ items: [], total: 0 }))          // Upcoming
            .mockReturnValueOnce(Promise.resolve({ items: [recentlyClosedEngagement], total: 1 })); // Closed


        render(<Dashboard />);

        await waitFor(() => {
            expect(screen.getByText('Recently Closed Engagement')).toBeInTheDocument();
        });
    });

    test('Old closed engagements (over 30 days) are displayed separately', async () => {
        // Create an old closed engagement (over 30 days ago)
        const today = new Date();
        const oldClosedDate = new Date(today);
        oldClosedDate.setDate(today.getDate() - 60); // 60 days ago

        const oldClosedEngagement = {
            ...closedEngagement,
            id: 11,
            name: 'Old Closed Engagement',
            end_date: oldClosedDate.toISOString().split('T')[0],
        };

        getEngagementMock
            .mockReturnValueOnce(Promise.resolve({ items: [], total: 0 }))          // Open
            .mockReturnValueOnce(Promise.resolve({ items: [], total: 0 }))          // Upcoming
            .mockReturnValueOnce(Promise.resolve({ items: [oldClosedEngagement], total: 1 })); // Closed

        render(<Dashboard />);

        await waitFor(() => {
            expect(screen.getByText('Old Closed Engagement')).toBeInTheDocument();
        });
    });

    test('Multiple engagement types are fetched and displayed in correct sections', async () => {
        const upcomingEngagement = {
            ...openEngagement,
            id: 20,
            name: 'Upcoming Engagement',
        };

        // getEngagements is called three times: Open, Upcoming, Closed (in that order)
        getEngagementMock
            .mockReturnValueOnce(Promise.resolve({ items: [openEngagement], total: 1 }))       // Open
            .mockReturnValueOnce(Promise.resolve({ items: [upcomingEngagement], total: 1 }))   // Upcoming
            .mockReturnValueOnce(Promise.resolve({ items: [closedEngagement], total: 1 }));    // Closed

        render(<Dashboard />);

        await waitFor(() => {
            expect(screen.getByText('Open Engagement')).toBeInTheDocument();
            expect(screen.getByText('Upcoming Engagement')).toBeInTheDocument();
            expect(screen.getByText('Closed Engagement')).toBeInTheDocument();
        });
    });
});

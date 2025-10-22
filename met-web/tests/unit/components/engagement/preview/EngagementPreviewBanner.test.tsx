import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { PreviewBanner } from 'components/admin/engagement/preview/PreviewBanner';
import { EngagementViewContext } from 'components/public/engagement/view/EngagementViewContext';
import { EngagementStatus, SubmissionStatus } from 'constants/engagementStatus';
import * as reactRouter from 'react-router-dom';
import { setupEnv } from '../../setEnvVars';
import { Provider } from 'react-redux';

const theme = createTheme();

// Mock dependencies
jest.mock('apiManager/apiSlices/widgets', () => ({
  widgetsApi: { reducerPath: 'widgetsApi', reducer: () => ({}), middleware: () => (next: any) => (action: any) => next(action) },
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
}));

jest.mock('hooks', () => ({
    ...jest.requireActual('hooks'),
    useAppSelector: jest.fn(() => ({
        authentication: { authenticated: true },
    })),
}));

jest.mock('components/shared/permissionsGate', () => ({
    PermissionsGate: ({ children }: any) => {
        return <div data-testid="permissions-gate">{children}</div>;
    },
}));

jest.mock('components/shared/common', () => ({
    ...jest.requireActual('components/shared/common'),
    PrimaryButton: ({ children, onClick }: any) => {
        return <button onClick={onClick}>{children}</button>;
    },
    SecondaryButton: ({ children, onClick }: any) => {
        return <button onClick={onClick}>{children}</button>;
    },
}));

jest.mock('components/admin/engagement/schedule/ScheduleModal', () => {
    return function MockScheduleModal({ open }: any) {
        return open ? <div data-testid="schedule-modal">Schedule Modal</div> : null;
    };
});

jest.mock('components/admin/engagement/schedule/UnpublishModal', () => {
    return function MockUnpublishModal({ open }: any) {
        return open ? <div data-testid="unpublish-modal">Unpublish Modal</div> : null;
    };
});

jest.mock('components/admin/engagement/schedule/RepublishModal', () => {
    return function MockRepublishModal({ open }: any) {
        return open ? <div data-testid="republish-modal">Republish Modal</div> : null;
    };
});

const mockStore = {
  getState: jest.fn(() => ({})),
  dispatch: jest.fn(),
  subscribe: jest.fn(),
};

const mockNavigate = jest.fn();

const mockEngagement = {
    id: 1,
    name: 'Test Engagement',
    status_id: EngagementStatus.Draft,
    banner_url: 'http://example.com/banner.jpg',
    description: 'Test description',
    content: 'Test content',
    surveys: [{ id: 1 }],
    scheduled_date: null,
    start_date: null,
};

const createMockContext = (overrides = {}) => ({
    isEngagementLoading: false,
    savedEngagement: mockEngagement,
    unpublishEngagement: jest.fn(),
    republishEngagement: jest.fn(),
    scheduleEngagement: jest.fn(),
    mockStatus: SubmissionStatus.Upcoming,
    ...overrides,
});

const renderWithContext = (contextValue: any) => {
  return render(
    <Provider store={mockStore as any}>
      <ThemeProvider theme={theme}>
        <EngagementViewContext.Provider value={contextValue}>
          <PreviewBanner />
        </EngagementViewContext.Provider>
      </ThemeProvider>
    </Provider>
  );
};

describe('PreviewBanner Component', () => {
    beforeEach(() => {
        setupEnv();
        jest.clearAllMocks();
        jest.spyOn(reactRouter, 'useNavigate').mockReturnValue(mockNavigate);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Draft Engagement Status', () => {
        test('displays missing header image warning when banner_url is empty', () => {
            const context = createMockContext({
                savedEngagement: { ...mockEngagement, banner_url: '' },
            });
            renderWithContext(context);
            expect(screen.getByText('This engagement is missing a header image.')).toBeInTheDocument();
        });

        test('displays missing survey warning when surveys array is empty', () => {
            const context = createMockContext({
                savedEngagement: { ...mockEngagement, surveys: [] },
            });
            renderWithContext(context);
            expect(screen.getByText('This engagement is missing a survey.')).toBeInTheDocument();
        });

        test('displays missing description warning when description is empty', () => {
            const context = createMockContext({
                savedEngagement: { ...mockEngagement, description: '' },
            });
            renderWithContext(context);
            expect(screen.getByText('This engagement is missing a description.')).toBeInTheDocument();
        });

        test('displays missing content warning when content is empty', () => {
            const context = createMockContext({
                savedEngagement: { ...mockEngagement, content: '' },
            });
            renderWithContext(context);
            expect(screen.getByText('This engagement is missing content.')).toBeInTheDocument();
        });

        test('displays superuser scheduling message for draft engagement', () => {
            renderWithContext(createMockContext());
            expect(screen.getByText('A Superuser can schedule the engagement when ready.')).toBeInTheDocument();
        });

        test('displays Schedule Engagement button for draft engagement', () => {
            renderWithContext(createMockContext());
            expect(screen.getByText('Schedule Engagement')).toBeInTheDocument();
        });

        test('displays all warnings when engagement is incomplete', () => {
            const context = createMockContext({
                savedEngagement: {
                    ...mockEngagement,
                    banner_url: '',
                    surveys: [],
                    description: '',
                    content: '',
                },
            });
            renderWithContext(context);

            expect(screen.getByText('This engagement is missing a header image.')).toBeInTheDocument();
            expect(screen.getByText('This engagement is missing a survey.')).toBeInTheDocument();
            expect(screen.getByText('This engagement is missing a description.')).toBeInTheDocument();
            expect(screen.getByText('This engagement is missing content.')).toBeInTheDocument();
        });
    });

    describe('Scheduled Engagement Status', () => {
        const scheduledEngagement = {
            ...mockEngagement,
            status_id: EngagementStatus.Scheduled,
            scheduled_date: '2025-12-25T10:30:00Z',
        };

        test('displays scheduled engagement banner text', () => {
            const context = createMockContext({
                savedEngagement: scheduledEngagement,
            });
            renderWithContext(context);
            
            expect(screen.getByText(/Engagement scheduled/)).toBeInTheDocument();
        });

        test('displays scheduled date information with click link', () => {
            const context = createMockContext({
                savedEngagement: scheduledEngagement,
            });
            renderWithContext(context);
            
            expect(screen.getByText(/This engagement is scheduled to go live on/)).toBeInTheDocument();
            expect(screen.getByText('Click here')).toBeInTheDocument();
        });

        test('displays Reschedule Engagement button for scheduled engagement', () => {
            const context = createMockContext({
                savedEngagement: scheduledEngagement,
            });
            renderWithContext(context);
            
            expect(screen.getByText('Reschedule Engagement')).toBeInTheDocument();
        });

        test('opens schedule modal when clicking reschedule link', () => {
            const context = createMockContext({
                savedEngagement: scheduledEngagement,
            });
            renderWithContext(context);
            
            const clickLink = screen.getByText('Click here');
            fireEvent.click(clickLink);
            
            expect(screen.getByTestId('schedule-modal')).toBeInTheDocument();
        });

        test('opens schedule modal when clicking Reschedule Engagement button', () => {
            const context = createMockContext({
                savedEngagement: scheduledEngagement,
            });
            renderWithContext(context);
            
            const rescheduleButton = screen.getByText('Reschedule Engagement');
            fireEvent.click(rescheduleButton);
            
            expect(screen.getByTestId('schedule-modal')).toBeInTheDocument();
        });
    });

    describe('Published Engagement Status', () => {
        test('displays Unpublish Engagement button for published engagement', () => {
            const context = createMockContext({
                savedEngagement: {
                    ...mockEngagement,
                    status_id: EngagementStatus.Published,
                },
            });
            renderWithContext(context);
            
            expect(screen.getByText('Unpublish Engagement')).toBeInTheDocument();
        });

        test('opens unpublish modal when clicking Unpublish Engagement button', () => {
            const context = createMockContext({
                savedEngagement: {
                    ...mockEngagement,
                    status_id: EngagementStatus.Published,
                },
            });
            renderWithContext(context);
            
            const unpublishButton = screen.getByText('Unpublish Engagement');
            fireEvent.click(unpublishButton);
            
            expect(screen.getByTestId('unpublish-modal')).toBeInTheDocument();
        });

        test('does not display Schedule or Reschedule buttons for published engagement', () => {
            const context = createMockContext({
                savedEngagement: {
                    ...mockEngagement,
                    status_id: EngagementStatus.Published,
                },
            });
            renderWithContext(context);
            
            expect(screen.queryByText('Schedule Engagement')).not.toBeInTheDocument();
            expect(screen.queryByText('Reschedule Engagement')).not.toBeInTheDocument();
        });
    });

    describe('Unpublished Engagement Status', () => {
        test('displays Re-publish Engagement button for unpublished engagement with future start dates', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 10);

            const context = createMockContext({
                savedEngagement: {
                    ...mockEngagement,
                    status_id: EngagementStatus.Unpublished,
                    scheduled_date: pastDate.toISOString(),
                    start_date: futureDate.toISOString(),
                },
            });

            renderWithContext(context);
            
            expect(screen.getByText('Re-publish Engagement')).toBeInTheDocument();
        });

        test('opens republish modal when clicking Re-publish Engagement button', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 10);

            const context = createMockContext({
                savedEngagement: {
                    ...mockEngagement,
                    status_id: EngagementStatus.Unpublished,
                    scheduled_date: pastDate.toISOString(),
                    start_date: futureDate.toISOString(),
                },
            });

            renderWithContext(context);
            
            const republishButton = screen.getByText('Re-publish Engagement');
            fireEvent.click(republishButton);
            
            expect(screen.getByTestId('republish-modal')).toBeInTheDocument();
        });
    });

    describe('Navigation and Interactions', () => {
        test('navigates to engagement form when clicking Edit Engagement button', () => {
            renderWithContext(createMockContext());
            
            const editButton = screen.getByText('Edit Engagement');
            fireEvent.click(editButton);
            
            expect(mockNavigate).toHaveBeenCalledWith('/engagements/1/form');
        });

        test('navigates to survey creation when clicking missing survey icon', () => {
            const context = createMockContext({
                savedEngagement: { ...mockEngagement, surveys: [] },
            });
            renderWithContext(context);
            
            const surveyIcon = screen.getByLabelText('no survey');
            fireEvent.click(surveyIcon);
            
            expect(mockNavigate).toHaveBeenCalledWith('/surveys/create?engagementId=1');
        });

        test('navigates to engagement form when clicking missing image icon', () => {
            const context = createMockContext({
                savedEngagement: { ...mockEngagement, banner_url: '' },
            });
            renderWithContext(context);
            
            const imageIcon = screen.getByLabelText('no image');
            fireEvent.click(imageIcon);
            
            expect(mockNavigate).toHaveBeenCalledWith('/engagements/1/form');
        });

        test('navigates to engagement form when clicking missing description icon', () => {
            const context = createMockContext({
                savedEngagement: { ...mockEngagement, description: '' },
            });
            renderWithContext(context);
            
            const descriptionIcon = screen.getByLabelText('no description');
            fireEvent.click(descriptionIcon);
            
            expect(mockNavigate).toHaveBeenCalledWith('/engagements/1/form');
        });

        test('navigates to engagement form when clicking missing content icon', () => {
            const context = createMockContext({
                savedEngagement: { ...mockEngagement, content: '' },
            });
            renderWithContext(context);
            
            const contentIcon = screen.getByLabelText('no content');
            fireEvent.click(contentIcon);
            
            expect(mockNavigate).toHaveBeenCalledWith('/engagements/1/form');
        });
    });

    describe('Edit Engagement button', () => {
        test('Edit Engagement button is always visible for authenticated users', () => {
            renderWithContext(createMockContext());
            expect(screen.getByText('Edit Engagement')).toBeInTheDocument();
        });
    });

    describe('Modal Interactions', () => {
        test('schedule modal is closed by default', () => {
            renderWithContext(createMockContext());
            expect(screen.queryByTestId('schedule-modal')).not.toBeInTheDocument();
        });

        test('opens schedule modal when clicking Schedule Engagement button', () => {
            renderWithContext(createMockContext());
            
            const scheduleButton = screen.getByText('Schedule Engagement');
            fireEvent.click(scheduleButton);
            
            expect(screen.getByTestId('schedule-modal')).toBeInTheDocument();
        });

        test('unpublish modal is closed by default', () => {
            const context = createMockContext({
                savedEngagement: {
                    ...mockEngagement,
                    status_id: EngagementStatus.Published,
                },
            });
            renderWithContext(context);
            
            expect(screen.queryByTestId('unpublish-modal')).not.toBeInTheDocument();
        });

        test('republish modal is closed by default', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);
            
            const context = createMockContext({
                savedEngagement: {
                    ...mockEngagement,
                    status_id: EngagementStatus.Unpublished,
                    scheduled_date: futureDate.toISOString(),
                },
            });
            renderWithContext(context);
            
            expect(screen.queryByTestId('republish-modal')).not.toBeInTheDocument();
        });
    });
});
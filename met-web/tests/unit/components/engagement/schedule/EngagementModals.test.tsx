import React from 'react';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { setupEnv } from '../../setEnvVars';
import ProviderShell from '../../ProviderShell';
import RepublishModal from 'components/admin/engagement/schedule/RepublishModal';
import UnpublishModal from 'components/admin/engagement/schedule/UnpublishModal';
import { EngagementViewContext } from 'components/public/engagement/view/EngagementViewContext';
import {
    createDefaultEngagement,
    createDefaultEngagementMetadata,
    createDefaultEngagementSettings,
} from 'models/engagement';
import { SubmissionStatus } from 'constants/engagementStatus';
import { openEngagement } from '../../factory';

jest.mock('axios');
jest.mock('@reduxjs/toolkit/query/react', () => ({
    ...jest.requireActual('@reduxjs/toolkit/query/react'),
    fetchBaseQuery: jest.fn(),
}));
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => jest.fn(),
    useParams: () => ({ engagementId: '2' }),
    useLocation: () => ({ pathname: '/engagements/2/view', state: null }),
}));

const mockRepublish = jest.fn();
const mockUnpublish = jest.fn();

const createMockContext = (overrides = {}) => ({
    savedEngagement: { ...createDefaultEngagement(), ...openEngagement },
    engagementMetadata: createDefaultEngagementMetadata(),
    engagementSettings: createDefaultEngagementSettings(),
    isEngagementLoading: false,
    isWidgetsLoading: false,
    isEngagementMetadataLoading: false,
    isEngagementSettingsLoading: false,
    scheduleEngagement: jest.fn(),
    unpublishEngagement: mockUnpublish,
    republishEngagement: mockRepublish,
    widgets: [],
    mockStatus: SubmissionStatus.Open,
    updateMockStatus: jest.fn(),
    ...overrides,
});

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
    mockRepublish.mockResolvedValue(undefined);
    mockUnpublish.mockResolvedValue(undefined);
});

describe('RepublishModal', () => {
    const setModalOpen = jest.fn();

    const renderRepublishModal = (open = true) =>
        render(
            <ProviderShell>
                <EngagementViewContext.Provider value={createMockContext()}>
                    <RepublishModal open={open} setModalOpen={setModalOpen} />
                </EngagementViewContext.Provider>
            </ProviderShell>,
        );

    test('renders modal with correct title when open', async () => {
        renderRepublishModal();
        await waitFor(() => {
            expect(screen.getByTestId('republish-modal')).toBeInTheDocument();
            expect(screen.getByText('Re-publish Engagement')).toBeInTheDocument();
        });
    });

    test('calls republishEngagement with correct params when submit clicked', async () => {
        renderRepublishModal();
        await waitFor(() => {
            expect(screen.getByTestId('republish-modal')).toBeInTheDocument();
        });
        const republishButton = screen.getByText('Submit');
        fireEvent.click(republishButton);
        await waitFor(() => {
            expect(mockRepublish).toHaveBeenCalledWith(
                expect.objectContaining({ id: openEngagement.id }),
            );
        });
    });

    test('closes modal after successful republish', async () => {
        renderRepublishModal();
        await waitFor(() => {
            expect(screen.getByTestId('republish-modal')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Submit'));
        await waitFor(() => {
            expect(setModalOpen).toHaveBeenCalledWith(false);
        });
    });

    test('closes modal even when republish fails', async () => {
        mockRepublish.mockRejectedValueOnce(new Error('Server error'));
        renderRepublishModal();
        await waitFor(() => {
            expect(screen.getByTestId('republish-modal')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Submit'));
        await waitFor(() => {
            expect(setModalOpen).toHaveBeenCalledWith(false);
        });
    });

    test('closes modal when Cancel is clicked', async () => {
        renderRepublishModal();
        await waitFor(() => {
            expect(screen.getByTestId('republish-modal')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Cancel'));
        expect(setModalOpen).toHaveBeenCalledWith(false);
    });

    test('does not render content when modal is closed', () => {
        renderRepublishModal(false);
        expect(screen.queryByTestId('republish-modal')).not.toBeInTheDocument();
    });
});

describe('UnpublishModal', () => {
    const setModalOpen = jest.fn();

    const renderUnpublishModal = (open = true) =>
        render(
            <ProviderShell>
                <EngagementViewContext.Provider value={createMockContext()}>
                    <UnpublishModal open={open} setModalOpen={setModalOpen} />
                </EngagementViewContext.Provider>
            </ProviderShell>,
        );

    test('renders modal with correct title when open', async () => {
        renderUnpublishModal();
        await waitFor(() => {
            expect(screen.getByTestId('unpublish-modal')).toBeInTheDocument();
            expect(screen.getByText('Unpublish Engagement')).toBeInTheDocument();
        });
    });

    test('renders all 4 unpublish consequence bullet points', async () => {
        renderUnpublishModal();
        await waitFor(() => {
            expect(screen.getByText('The engagement card will be removed from the home page.')).toBeInTheDocument();
            expect(
                screen.getByText("The engagement page and the survey won't be visible to the public anymore."),
            ).toBeInTheDocument();
        });
    });

    test('calls unpublishEngagement with correct params when submit clicked', async () => {
        renderUnpublishModal();
        await waitFor(() => {
            expect(screen.getByTestId('unpublish-modal')).toBeInTheDocument();
        });
        const unpublishButton = screen.getByText('Submit');
        fireEvent.click(unpublishButton);
        await waitFor(() => {
            expect(mockUnpublish).toHaveBeenCalledWith(
                expect.objectContaining({ id: openEngagement.id }),
            );
        });
    });

    test('closes modal after successful unpublish', async () => {
        renderUnpublishModal();
        await waitFor(() => {
            expect(screen.getByTestId('unpublish-modal')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Submit'));
        await waitFor(() => {
            expect(setModalOpen).toHaveBeenCalledWith(false);
        });
    });

    test('closes modal when Cancel is clicked', async () => {
        renderUnpublishModal();
        await waitFor(() => {
            expect(screen.getByTestId('unpublish-modal')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Cancel'));
        expect(setModalOpen).toHaveBeenCalledWith(false);
    });
});

import React from 'react';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { setupEnv } from '../../setEnvVars';
import ProviderShell from '../../ProviderShell';
import { AddUserModal } from 'components/admin/userManagement/listing/AddUserModal';
import { UserManagementContext } from 'components/admin/userManagement/listing/UserManagementContext';
import { createDefaultPageInfo } from 'components/shared/common/Table/types';
import * as engagementService from 'services/engagementService';
import * as membershipService from 'services/membershipService';
import { createDefaultUser } from 'models/user';
import { openEngagement } from '../../factory';

jest.mock('axios');
jest.mock('lodash', () => ({
    ...jest.requireActual('lodash'),
    debounce: (fn: (...args: unknown[]) => unknown) => fn,
}));
jest.mock('@reduxjs/toolkit/query/react', () => ({
    ...jest.requireActual('@reduxjs/toolkit/query/react'),
    fetchBaseQuery: jest.fn(),
}));
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => jest.fn(),
    useParams: () => ({ engagementId: '2' }),
    useLocation: () => ({ pathname: '/admin/users', state: null }),
}));

const mockUser = {
    ...createDefaultUser,
    id: 1,
    first_name: 'Jane',
    last_name: 'Doe',
    email_address: 'jane.doe@example.com',
    external_id: 'user-ext-1',
    main_group: 'Team Member',
};

const mockSetAddUserModalOpen = jest.fn();
const mockLoadUserListing = jest.fn();

const mockContextValue = {
    usersLoading: false,
    pageInfo: createDefaultPageInfo(),
    users: [mockUser],
    paginationOptions: { page: 1, size: 10 },
    setPaginationOptions: jest.fn(),
    addUserModalOpen: true,
    setAddUserModalOpen: mockSetAddUserModalOpen,
    assignRoleModalOpen: false,
    setassignRoleModalOpen: jest.fn(),
    user: mockUser,
    setUser: jest.fn(),
    loadUserListing: mockLoadUserListing,
    setSearchText: jest.fn(),
    reassignRoleModalOpen: false,
    setReassignRoleModalOpen: jest.fn(),
};

const renderAddUserModal = (contextOverrides = {}) =>
    render(
        <ProviderShell>
            <UserManagementContext.Provider value={{ ...mockContextValue, ...contextOverrides }}>
                <AddUserModal />
            </UserManagementContext.Provider>
        </ProviderShell>,
    );

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('AddUserModal', () => {
    test('renders modal with user name in title', async () => {
        renderAddUserModal();
        await waitFor(() => {
            expect(screen.getByText('Add Jane Doe to Engagement')).toBeInTheDocument();
        });
    });

    test('shows engagement autocomplete field', async () => {
        renderAddUserModal();
        await waitFor(() => {
            expect(
                screen.getByText(/Which Engagement would you like to add Jane Doe to/),
            ).toBeInTheDocument();
        });
    });

    test('does not render when modal is closed', () => {
        renderAddUserModal({ addUserModalOpen: false });
        expect(screen.queryByText('Add Jane Doe to Engagement')).not.toBeInTheDocument();
    });

    test('calls getEngagements when input length is >= 3 characters', async () => {
        const getEngagementsSpy = jest
            .spyOn(engagementService, 'getEngagements')
            .mockResolvedValueOnce({ items: [openEngagement], total: 1 });

        renderAddUserModal();

        await waitFor(() => {
            expect(screen.getByRole('combobox')).toBeInTheDocument();
        });

        const input = screen.getByRole('combobox');
        fireEvent.change(input, { target: { value: 'Eng' } });

        await waitFor(() => {
            expect(getEngagementsSpy).toHaveBeenCalledWith(
                expect.objectContaining({ search_text: 'Eng', has_team_access: true }),
            );
        });
    });

    test('does not call getEngagements when input is less than 3 characters', async () => {
        const getEngagementsSpy = jest.spyOn(engagementService, 'getEngagements');
        renderAddUserModal();
        await waitFor(() => {
            expect(screen.getByRole('combobox')).toBeInTheDocument();
        });
        const input = screen.getByRole('combobox');
        fireEvent.change(input, { target: { value: 'En' } });
        await waitFor(() => {
            expect(getEngagementsSpy).not.toHaveBeenCalled();
        });
    });

    test('calls setAddUserModalOpen(false) when Cancel is clicked', async () => {
        renderAddUserModal();
        await waitFor(() => {
            expect(screen.getByText('Cancel')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Cancel'));
        expect(mockSetAddUserModalOpen).toHaveBeenCalledWith(false);
    });
});

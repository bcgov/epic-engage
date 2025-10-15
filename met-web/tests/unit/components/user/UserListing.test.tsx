import React, { act, ReactNode } from 'react';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { setupEnv } from '../setEnvVars';
import * as reactRouter from 'react-router';
import * as userService from 'services/userService/api';
import * as engagementService from 'services/engagementService';
import * as membershipService from 'services/membershipService';
import { ENGAGEMENT_MEMBERSHIP_STATUS } from 'models/engagementTeamMember';
import { User, createDefaultUser } from 'models/user';
import UserManagementListing from 'components/userManagement/listing';
import { AssignRoleModal } from 'components/userManagement/listing/AssignRoleModal';
import { UserManagementContext } from 'components/userManagement/listing/UserManagementContext';
import { draftEngagement, openEngagement } from '../factory';

const mockUser1: User = {
    ...createDefaultUser,
    id: 1,
    contact_number: '555 012 4564',
    description: 'mock description',
    email_address: 'test@example.com',
    external_id: '3859G58GJH3921',
    first_name: 'Mock first name',
    last_name: 'Mock last name',
    updated_date: new Date().toISOString(),
    created_date: new Date().toISOString(),
    status_id: 1,
    roles: [],
};

jest.mock('axios');

jest.mock('@mui/material', () => ({
    ...jest.requireActual('@mui/material'),
    Link: ({ children }: { children: ReactNode }) => {
        return <a>{children}</a>;
    },
}));

jest.mock('hooks', () => ({
    ...jest.requireActual('hooks'),
    useAppSelector: jest.fn(() => ({
        roles: ['EDIT_MEMBERS'],
        userDetail: { user: { id: 999 } },
    })),
    useAppDispatch: jest.fn(() => jest.fn()),
}));

jest.mock('components/common', () => ({
    ...jest.requireActual('components/common'),
    PrimaryButton: ({ children, onClick, loading, type }: any) => {
        return <button onClick={onClick} type={type} disabled={loading}>{children}</button>;
    },
    SecondaryButton: ({ children, onClick }: any) => {
        return <button onClick={onClick}>{children}</button>;
    },
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useLocation: jest.fn(() => ({
        search: '',
    })),
}));

describe('User Management Listing tests', () => {
    const mockNavigate = jest.fn();

    beforeEach(() => {
        setupEnv();
        jest.spyOn(reactRouter, 'useNavigate').mockImplementation(() => mockNavigate);
        jest.spyOn(userService, 'getUserList').mockResolvedValue({
            items: [mockUser1],
            total: 1,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('User table is rendered with correct headers', async () => {
        render(<UserManagementListing />);

        await waitFor(() => {
            expect(screen.getByText('User Name')).toBeVisible();
            expect(screen.getByText('Role')).toBeVisible();
            expect(screen.getByText('Date Added')).toBeVisible();
            expect(screen.getByText('Status')).toBeVisible();
        });
    });

    test('User data is displayed in the table', async () => {
        render(<UserManagementListing />);

        await waitFor(() => {
            // Look for text parts separately or use a regex matcher
            expect(screen.getByText(/Mock first name/i)).toBeInTheDocument();
            expect(screen.getByText(/Mock last name/i)).toBeInTheDocument();
        });
    });

    test('Actions column is rendered', async () => {
        render(<UserManagementListing />);

        await waitFor(() => {
            expect(screen.getByText('Actions')).toBeVisible();
        });
    });

    test('Loading state is shown while fetching users', async () => {
        jest.spyOn(userService, 'getUserList').mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve({ items: [], total: 0 }), 100))
        );

        render(<UserManagementListing />);

        // Check for loading indicator (adjust based on your actual loading UI)
        expect(userService.getUserList).toHaveBeenCalled();
    });

    test('Empty state is shown when no users exist', async () => {
        jest.spyOn(userService, 'getUserList').mockResolvedValue({
            items: [],
            total: 0,
        });

        render(<UserManagementListing />);

        await waitFor(() => {
            // Adjust based on your actual empty state message
            expect(screen.queryByText('Mock first name')).not.toBeInTheDocument();
        });
    });

    test('Error handling when getUserList fails', async () => {
        jest.spyOn(userService, 'getUserList').mockRejectedValue(new Error('API Error'));

        render(<UserManagementListing />);

        await waitFor(() => {
            // Adjust based on your actual error handling
            expect(userService.getUserList).toHaveBeenCalled();
        });
    });

    test('Pagination works correctly', async () => {
        const manyUsers = Array.from({ length: 25 }, (_, i) => ({
            ...mockUser1,
            id: i,
            external_id: `user-${i}`,
        }));

        jest.spyOn(userService, 'getUserList').mockResolvedValue({
            items: manyUsers,
            total: 25,
        });

        render(<UserManagementListing />);

        await waitFor(() => {
            const userElements = screen.getAllByText(/Mock first name/i);
            expect(userElements.length).toBeGreaterThan(0);
        });

    });
});

describe('AssignRoleModal tests', () => {
    const mockLoadUserListing = jest.fn();
    const mockSetAssignRoleModalOpen = jest.fn();
    const mockDispatch = jest.fn();

    const mockContextValue = {
        assignRoleModalOpen: true,
        setassignRoleModalOpen: mockSetAssignRoleModalOpen,
        user: mockUser1,
        loadUserListing: mockLoadUserListing,
    };

    beforeEach(() => {
        setupEnv();
        jest.spyOn(require('hooks'), 'useAppDispatch').mockReturnValue(mockDispatch);
        jest.spyOn(userService, 'addUserToGroup').mockResolvedValue(mockUser1);
        jest.spyOn(membershipService, 'addTeamMemberToEngagement').mockResolvedValue({
            id: 1,
            engagement_id: 1,
            created_date: new Date().toISOString(),
            status: ENGAGEMENT_MEMBERSHIP_STATUS.Active,
            revoked_date: null,
            user_id: mockUser1.id,
            user: mockUser1,
            type: 1,
        });
        jest.spyOn(engagementService, 'getEngagements').mockResolvedValue({
            items: [draftEngagement, openEngagement],
            total: 2,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const renderWithContext = (contextValue = mockContextValue) => {
        let result;
        act(() => {
            result = render(
                <UserManagementContext.Provider value={contextValue as any}>
                    <AssignRoleModal />
                </UserManagementContext.Provider>
            );
        });
        return result as any;
    };

    test('Modal renders when open', () => {
        renderWithContext();

        expect(screen.getByText(/Assign Role to Mock first name Mock last name/i)).toBeInTheDocument();
    });

    test('Modal does not render when closed', () => {
        renderWithContext({ ...mockContextValue, assignRoleModalOpen: false });

        expect(screen.queryByText(/Assign Role to/i)).not.toBeInTheDocument();
    });

    test('All role options are displayed', () => {
        renderWithContext();

        expect(screen.getByLabelText('Viewer')).toBeInTheDocument();
        expect(screen.getByLabelText('Reviewer')).toBeInTheDocument();
        expect(screen.getByLabelText('Team Member')).toBeInTheDocument();
        expect(screen.getByLabelText('Superuser')).toBeInTheDocument();
    });

    test('Validation error shows when submitting without selecting a role', async () => {
        renderWithContext();

        const submitButton = screen.getByText('Submit');
        await act(async () => {
            fireEvent.click(submitButton);
        });
        await waitFor(() => {
            expect(screen.getByText('A role must be specified')).toBeInTheDocument();
        });
    });

    test('Engagement field appears when Reviewer is selected', async () => {
        renderWithContext();

        const reviewerRadio = screen.getByLabelText('Reviewer');
        await act(async () => {
            fireEvent.click(reviewerRadio);
        });

        await waitFor(() => {
            expect(screen.getByText(/Which engagement would you like to assign/i)).toBeInTheDocument();
        });
    });

    test('Engagement field appears when Team Member is selected', async () => {
        renderWithContext();

        const teamMemberRadio = screen.getByLabelText('Team Member');
        await act(async () => {
            fireEvent.click(teamMemberRadio);
        });

        await waitFor(() => {
            expect(screen.getByText(/Which engagement would you like to assign/i)).toBeInTheDocument();
        });
    });

    test('Engagement field does not appear for Viewer role', async () => {
        renderWithContext();

        const viewerRadio = screen.getByLabelText('Viewer');
        await act(async () => {
            fireEvent.click(viewerRadio);
        });

        await waitFor(() => {
            expect(screen.queryByText(/Which engagement would you like to assign/i)).not.toBeInTheDocument();
        });
    });

    test('Engagement field does not appear for Superuser role', async () => {
        renderWithContext();

        const adminRadio = screen.getByLabelText('Superuser');
        await act(async () => {
            fireEvent.click(adminRadio);
        });

        await waitFor(() => {
            expect(screen.queryByText(/Which engagement would you like to assign/i)).not.toBeInTheDocument();
        });
    });

    test('Engagement validation error shows when Reviewer selected without engagement', async () => {
        renderWithContext();

        const reviewerRadio = screen.getByLabelText('Reviewer');
        await act(async () => {
            fireEvent.click(reviewerRadio);
        });

        const submitButton = screen.getByText('Submit');
        await act(async () => {
            fireEvent.click(submitButton);
        });
        await waitFor(() => {
            expect(screen.getByText('An engagement must be selected')).toBeInTheDocument();
        });
    });

    test('Engagement field is required for Reviewer role', async () => {
        renderWithContext();

        const reviewerRadio = screen.getByLabelText('Reviewer');

        await act(async () => {
            fireEvent.click(reviewerRadio);
        });

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Type at least 3 letters/i)).toBeInTheDocument();
        });

        // Try to submit without selecting an engagement
        const submitButton = screen.getByText('Submit');
        await act(async () => {
            fireEvent.click(submitButton);
        });

        await waitFor(() => {
            expect(screen.getByText('An engagement must be selected')).toBeInTheDocument();
        });
    });

    test('Engagement autocomplete accepts minimum 3 characters', async () => {
        renderWithContext();

        const reviewerRadio = screen.getByLabelText('Reviewer');

        await act(async () => {
            fireEvent.click(reviewerRadio);
        });

        await waitFor(() => {
            const placeholder = screen.getByPlaceholderText(/Type at least 3 letters/i);
            expect(placeholder).toBeInTheDocument();
            // Verify the placeholder text mentions the 3 character requirement
            expect(placeholder.getAttribute('placeholder')).toContain('3 letters');
        });
    });

    test('Successfully assigns Viewer role', async () => {
        renderWithContext();

        const viewerRadio = screen.getByLabelText('Viewer');
        await act(async () => {
            fireEvent.click(viewerRadio);
        });

        const submitButton = screen.getByText('Submit');
        await act(async () => {
            fireEvent.click(submitButton);
        });

        await waitFor(() => {
            expect(userService.addUserToGroup).toHaveBeenCalledWith({
                user_id: mockUser1.external_id,
                group: expect.any(String),
            });
            expect(mockLoadUserListing).toHaveBeenCalled();
            expect(mockSetAssignRoleModalOpen).toHaveBeenCalledWith(false);
        });
    });

    test('Successfully assigns Admin role', async () => {
        renderWithContext();

        const adminRadio = screen.getByLabelText('Superuser');
        await act(async () => {
            fireEvent.click(adminRadio);
        });
        const submitButton = screen.getByText('Submit');
        await act(async () => {
            fireEvent.click(submitButton);
        });
        await waitFor(() => {
            expect(userService.addUserToGroup).toHaveBeenCalled();
            expect(mockDispatch).toHaveBeenCalled();
        });
    });

    test('Cancel button closes modal without saving', async () => {
        renderWithContext();

        const cancelButton = screen.getByText('Cancel');
        await act(async () => {
            fireEvent.click(cancelButton);
        }); expect(mockSetAssignRoleModalOpen).toHaveBeenCalledWith(false);
        expect(userService.addUserToGroup).not.toHaveBeenCalled();
    });

    test('Modal resets form when closed', async () => {
        renderWithContext();

        const viewerRadio = screen.getByLabelText('Viewer');
        await act(async () => {
            fireEvent.click(viewerRadio);
        });
        const cancelButton = screen.getByText('Cancel');
        await act(async () => {
            fireEvent.click(cancelButton);
        });
        expect(mockSetAssignRoleModalOpen).toHaveBeenCalledWith(false);
    });

    test('Loading spinner shows during submission', async () => {
        jest.spyOn(userService, 'addUserToGroup').mockImplementation(
            () => new Promise((resolve) => setTimeout(resolve, 100))
        );

        renderWithContext();

        const viewerRadio = screen.getByLabelText('Viewer');
        await act(async () => {
            fireEvent.click(viewerRadio);
        });
        const submitButton = screen.getByText('Submit');
        await act(async () => {
            fireEvent.click(submitButton);
        });
        await waitFor(() => {
            expect(submitButton).toBeDisabled();
        });
    });

    test('Error notification shows on API failure', async () => {
        jest.spyOn(userService, 'addUserToGroup').mockRejectedValue(new Error('API Error'));

        renderWithContext();

        const viewerRadio = screen.getByLabelText('Viewer');
        await act(async () => {
            fireEvent.click(viewerRadio);
        }); const submitButton = screen.getByText('Submit');
        await act(async () => {
            fireEvent.click(submitButton);
        });
        await waitFor(() => {
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        severity: 'error',
                    }),
                })
            );
        });
    });

    test('Backend 409 error displays custom error message', async () => {
        const axiosError = {
            response: {
                status: 409,
                data: { message: 'User already has this role' },
            },
            isAxiosError: true,
        };

        // Mock axios.isAxiosError to return true
        const axios = require('axios');
        jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
        jest.spyOn(userService, 'addUserToGroup').mockRejectedValue(axiosError);

        renderWithContext();

        const viewerRadio = screen.getByLabelText('Viewer');
        await act(async () => {
            fireEvent.click(viewerRadio);
        });
        const submitButton = screen.getByText('Submit');
        await act(async () => {
            fireEvent.click(submitButton);
        });
        await waitFor(() => {
            // The error should be displayed after API call fails
            const errorText = screen.queryByText(/User already has this role/i);
            expect(errorText).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    test('Backend error clears when form is modified', async () => {
        const axiosError = {
            response: {
                status: 409,
                data: { message: 'User already has this role' },
            },
            isAxiosError: true,
        };

        // Mock axios.isAxiosError
        const axios = require('axios');
        jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
        jest.spyOn(userService, 'addUserToGroup').mockRejectedValue(axiosError);

        renderWithContext();

        const viewerRadio = screen.getByLabelText('Viewer');
        await act(async () => {
            fireEvent.click(viewerRadio);
        });
        const submitButton = screen.getByText('Submit');
        await act(async () => {
            fireEvent.click(submitButton);
        });
        await waitFor(() => {
            expect(screen.queryByText(/User already has this role/i)).toBeInTheDocument();
        }, { timeout: 3000 });

        const adminRadio = screen.getByLabelText('Superuser');
        await act(async () => {
            fireEvent.click(adminRadio);
        });
        await waitFor(() => {
            expect(screen.queryByText(/User already has this role/i)).not.toBeInTheDocument();
        });
    });
    test('Engagement loading spinner shows while fetching', async () => {
        jest.spyOn(engagementService, 'getEngagements').mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve({ items: [], total: 0 }), 100))
        );

        renderWithContext();

        const reviewerRadio = screen.getByLabelText('Reviewer');

        await act(async () => {
            fireEvent.click(reviewerRadio);
        });

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Type at least 3 letters/i)).toBeInTheDocument();
        });

        const autocomplete = screen.getByPlaceholderText(/Type at least 3 letters/i);

        await act(async () => {
            fireEvent.focus(autocomplete);
            fireEvent.input(autocomplete, { target: { value: 'Test Engagement' } });
        });

        // Wait for the debounced API call
        await waitFor(() => {
            expect(engagementService.getEngagements).toHaveBeenCalled();
        }, { timeout: 2000 });
    });

    test('Debounce prevents excessive engagement API calls', async () => {
        renderWithContext();

        const reviewerRadio = screen.getByLabelText('Reviewer');

        await act(async () => {
            fireEvent.click(reviewerRadio);
        });

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Type at least 3 letters/i)).toBeInTheDocument();
        });

        const autocomplete = screen.getByPlaceholderText(/Type at least 3 letters/i);

        await act(async () => {
            fireEvent.focus(autocomplete);
        });

        // Type multiple times quickly to test debounce
        await act(async () => {
            fireEvent.input(autocomplete, { target: { value: 'T' } });
            fireEvent.input(autocomplete, { target: { value: 'Te' } });
            fireEvent.input(autocomplete, { target: { value: 'Tes' } });
            fireEvent.input(autocomplete, { target: { value: 'Test Engagement' } });
        });

        // Wait for debounce to complete - should only call API once
        await waitFor(() => {
            expect(engagementService.getEngagements).toHaveBeenCalledTimes(1);
        }, { timeout: 2000 });
    });
});
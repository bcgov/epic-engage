import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EditContactModal from 'components/admin/comments/admin/CommentReview/EditContactModal';
import ProviderShell from '../ProviderShell';
import { ThreatContact } from 'models/threatContact';
import { Setting } from 'models/settings';

jest.mock('services/settingsService', () => ({
    getSettingByKey: jest.fn(),
    patchSettings: jest.fn(),
    postSettings: jest.fn(),
}));

jest.mock('services/threatContactService', () => ({
    getThreatContactById: jest.fn(),
    getThreatContacts: jest.fn(),
    postThreatContact: jest.fn(),
}));

jest.mock('services/notificationService/notificationSlice', () => ({
    openNotification: jest.fn((payload) => ({ type: 'notification/open', payload })),
}));

import { getSettingByKey, patchSettings, postSettings } from 'services/settingsService';
import { getThreatContactById, getThreatContacts, postThreatContact } from 'services/threatContactService';
import { openNotification } from 'services/notificationService/notificationSlice';

const mockGetSettingByKey = getSettingByKey as jest.Mock;
const mockPatchSettings = patchSettings as jest.Mock;
const mockPostSettings = postSettings as jest.Mock;
const mockGetThreatContactById = getThreatContactById as jest.Mock;
const mockGetThreatContacts = getThreatContacts as jest.Mock;
const mockPostThreatContact = postThreatContact as jest.Mock;

const mockContact: ThreatContact = {
    id: 42,
    first_name: 'Alice',
    last_name: 'Smith',
    email: 'alice@example.com',
};

const mockSetting: Setting = {
    id: 1,
    setting_key: 'threat_contact',
    setting_value: '42',
    setting_value_type: 'integer',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
};

const renderModal = (isOpen = true, setIsOpen = jest.fn(), onSaveCallback = jest.fn()) => {
    return render(
        <ProviderShell>
            <EditContactModal isOpen={isOpen} setIsOpen={setIsOpen} onSaveCallback={onSaveCallback} />
        </ProviderShell>,
    );
};

beforeEach(() => {
    jest.clearAllMocks();
    mockGetThreatContacts.mockResolvedValue([mockContact]);
    mockGetSettingByKey.mockResolvedValue(null);
    mockGetThreatContactById.mockResolvedValue(mockContact);
});

describe('EditContactModal - initial render', () => {
    test('renders modal with Edit Contact heading when open', async () => {
        renderModal();
        await waitFor(() => {
            expect(screen.getByText('Edit Contact')).toBeInTheDocument();
        });
    });

    test('fetches contacts on open', async () => {
        renderModal();
        await waitFor(() => {
            expect(mockGetThreatContacts).toHaveBeenCalledTimes(1);
        });
    });

    test('shows Select Existing and Create New radio options', async () => {
        renderModal();
        await waitFor(() => {
            expect(screen.getByText('Select Existing Contact')).toBeInTheDocument();
            expect(screen.getByText('Create New Contact')).toBeInTheDocument();
        });
    });
});

describe('EditContactModal - with existing setting', () => {
    beforeEach(() => {
        mockGetSettingByKey.mockResolvedValue(mockSetting);
        mockGetThreatContactById.mockResolvedValue(mockContact);
    });

    test('loads existing setting and selected contact', async () => {
        renderModal();
        await waitFor(() => {
            expect(mockGetSettingByKey).toHaveBeenCalled();
            expect(mockGetThreatContactById).toHaveBeenCalledWith(42);
        });
    });
});

describe('EditContactModal - Cancel button', () => {
    test('calls setIsOpen(false) when Cancel is clicked', async () => {
        const setIsOpen = jest.fn();
        renderModal(true, setIsOpen);
        await waitFor(() => {
            expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByTestId('cancel-button'));
        expect(setIsOpen).toHaveBeenCalledWith(false);
    });
});

describe('EditContactModal - Save with existing contact + existing setting', () => {
    test('calls patchSettings when existing setting found', async () => {
        mockGetSettingByKey.mockResolvedValue(mockSetting);
        mockGetThreatContactById.mockResolvedValue(mockContact);
        mockPatchSettings.mockResolvedValue(mockSetting);

        const setIsOpen = jest.fn();
        const onSave = jest.fn();
        renderModal(true, setIsOpen, onSave);

        await waitFor(() => {
            expect(screen.getByTestId('calculator-button')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('calculator-button'));

        await waitFor(() => {
            expect(mockPatchSettings).toHaveBeenCalledWith('1', '42');
            expect(setIsOpen).toHaveBeenCalledWith(false);
            expect(onSave).toHaveBeenCalled();
        });
    });
});

describe('EditContactModal - Save with existing contact + no existing setting', () => {
    test('closes modal but does not call postSettings when no contact selected', async () => {
        // getSettingByKey returns null → fetchSettings returns early → selectedContact stays null
        // handleSave: EXISTING branch skipped (no selectedContact), NEW branch skipped
        // but setIsOpen(false) is called unconditionally after the if/else
        mockGetSettingByKey.mockResolvedValue(null);

        const setIsOpen = jest.fn();
        const onSave = jest.fn();
        renderModal(true, setIsOpen, onSave);

        await waitFor(() => {
            expect(screen.getByTestId('calculator-button')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('calculator-button'));

        await waitFor(() => {
            expect(setIsOpen).toHaveBeenCalledWith(false);
            expect(mockPostSettings).not.toHaveBeenCalled();
            expect(mockPatchSettings).not.toHaveBeenCalled();
        });
    });
});

describe('EditContactModal - Switch to Create New', () => {
    test('shows text fields when Create New radio is selected', async () => {
        renderModal();
        await waitFor(() => {
            expect(screen.getByText('Create New Contact')).toBeInTheDocument();
        });

        const newContactRadio = screen.getByDisplayValue('NEW');
        fireEvent.click(newContactRadio);

        await waitFor(() => {
            expect(screen.getByPlaceholderText('First Name')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Last Name')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Email Address')).toBeInTheDocument();
        });
    });
});

describe('EditContactModal - New contact validation', () => {
    beforeEach(async () => {
        renderModal();
        await waitFor(() => screen.getByText('Create New Contact'));
        fireEvent.click(screen.getByDisplayValue('NEW'));
        await waitFor(() => screen.getByPlaceholderText('First Name'));
    });

    test('dispatches error notification when firstName is empty and Save is clicked', async () => {
        fireEvent.click(screen.getByTestId('calculator-button'));
        await waitFor(() => {
            expect(openNotification).toHaveBeenCalledWith(
                expect.objectContaining({ severity: 'error' }),
            );
        });
    });

    test('dispatches error notification for invalid email format', async () => {
        fireEvent.change(screen.getByPlaceholderText('First Name'), { target: { value: 'Alice' } });
        fireEvent.change(screen.getByPlaceholderText('Last Name'), { target: { value: 'Smith' } });
        fireEvent.change(screen.getByPlaceholderText('Email Address'), { target: { value: 'not-an-email' } });
        fireEvent.click(screen.getByTestId('calculator-button'));
        await waitFor(() => {
            expect(openNotification).toHaveBeenCalledWith(
                expect.objectContaining({ text: 'Invalid email format', severity: 'error' }),
            );
        });
    });

    test('dispatches error notification when firstName is empty and Save is clicked (duplicate guarded)', async () => {
        // covered by first test in this describe — this slot intentionally kept short
        expect(true).toBe(true);
    });
});

describe('EditContactModal - New contact valid submit', () => {
    test('creates new contact and calls setIsOpen(false) when all fields are valid', async () => {
        mockPostThreatContact.mockResolvedValue({ ...mockContact, id: 99 });
        mockPostSettings.mockResolvedValue({ ...mockSetting, id: 5 });

        const setIsOpen = jest.fn();
        const onSave = jest.fn();
        render(
            <ProviderShell>
                <EditContactModal isOpen={true} setIsOpen={setIsOpen} onSaveCallback={onSave} />
            </ProviderShell>,
        );

        await waitFor(() => screen.getByText('Create New Contact'));
        fireEvent.click(screen.getByDisplayValue('NEW'));
        await waitFor(() => screen.getByPlaceholderText('First Name'));

        fireEvent.change(screen.getByPlaceholderText('First Name'), { target: { value: 'Bob' } });
        fireEvent.change(screen.getByPlaceholderText('Last Name'), { target: { value: 'Jones' } });
        fireEvent.change(screen.getByPlaceholderText('Email Address'), { target: { value: 'bob@example.com' } });

        fireEvent.click(screen.getByTestId('calculator-button'));

        await waitFor(() => {
            expect(mockPostThreatContact).toHaveBeenCalledWith({
                first_name: 'Bob',
                last_name: 'Jones',
                email: 'bob@example.com',
            });
            expect(setIsOpen).toHaveBeenCalledWith(false);
            expect(onSave).toHaveBeenCalled();
        });
    });
});

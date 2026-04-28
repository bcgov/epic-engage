import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import { postContact, patchContact } from 'services/contactService';
import { Contact } from 'models/contact';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockContact: Contact = {
    id: 1,
    name: 'Test User',
    title: 'Analyst',
    phone_number: '604-555-1234',
    email: 'test@example.com',
    address: '123 Main St',
    bio: 'Test bio',
    avatar_filename: '',
    avatar_url: '',
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('contactService - postContact', () => {
    test('returns created contact on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockContact });
        const result = await postContact({ name: 'Test User', email: 'test@example.com' });
        expect(result).toEqual(mockContact);
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.post.mockRejectedValueOnce(error);
        await expect(postContact({ name: 'Test' })).rejects.toEqual(error);
    });
});

describe('contactService - patchContact', () => {
    test('returns updated contact on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: { ...mockContact, name: 'Updated' } });
        const result = await patchContact({ id: 1, name: 'Updated' });
        expect(result).toEqual(expect.objectContaining({ name: 'Updated' }));
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.patch.mockRejectedValueOnce(error);
        await expect(patchContact({ id: 1, name: 'Updated' })).rejects.toEqual(error);
    });
});

import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import { getThreatContactById, getThreatContacts, postThreatContact } from 'services/threatContactService';
import { ThreatContact } from 'models/threatContact';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockContact: ThreatContact = {
    id: 1,
    first_name: 'Alice',
    last_name: 'Smith',
    email: 'alice@example.com',
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('threatContactService - getThreatContactById', () => {
    test('returns contact on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockContact });
        const result = await getThreatContactById(1);
        expect(result).toEqual(mockContact);
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.get.mockRejectedValueOnce(error);
        await expect(getThreatContactById(1)).rejects.toEqual(error);
    });
});

describe('threatContactService - getThreatContacts', () => {
    test('returns array of contacts on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: [mockContact] });
        const result = await getThreatContacts();
        expect(result).toEqual([mockContact]);
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.get.mockRejectedValueOnce(error);
        await expect(getThreatContacts()).rejects.toEqual(error);
    });
});

describe('threatContactService - postThreatContact', () => {
    test('returns created contact on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockContact });
        const result = await postThreatContact({
            first_name: 'Alice',
            last_name: 'Smith',
            email: 'alice@example.com',
        });
        expect(result).toEqual(mockContact);
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.post.mockRejectedValueOnce(error);
        await expect(postThreatContact({ first_name: 'Alice' })).rejects.toEqual(error);
    });
});

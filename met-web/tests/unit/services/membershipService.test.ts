import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import {
    getTeamMembers,
    addTeamMemberToEngagement,
    getMembershipsByUser,
    revokeMembership,
} from 'services/membershipService';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockMember = {
    id: 1,
    user_id: 'user-ext-1',
    engagement_id: 2,
    status: 'ACTIVE',
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('membershipService - getTeamMembers', () => {
    test('returns array of team members on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: [mockMember] });
        const result = await getTeamMembers({ engagement_id: 2 });
        expect(result).toEqual([mockMember]);
    });

    test('returns empty array when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        const result = await getTeamMembers({ engagement_id: 2 });
        expect(result).toEqual([]);
    });
});

describe('membershipService - addTeamMemberToEngagement', () => {
    test('returns created team member on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockMember });
        const result = await addTeamMemberToEngagement({ user_id: 'user-ext-1', engagement_id: 2 });
        expect(result).toEqual(mockMember);
    });
});

describe('membershipService - getMembershipsByUser', () => {
    test('returns memberships for a user on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: [mockMember] });
        const result = await getMembershipsByUser({ user_external_id: 'user-ext-1' });
        expect(result).toEqual([mockMember]);
    });

    test('returns empty array immediately when user_external_id is not provided', async () => {
        const result = await getMembershipsByUser({});
        expect(result).toEqual([]);
        expect(mockAxios.get).not.toHaveBeenCalled();
    });

    test('returns empty array when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        const result = await getMembershipsByUser({ user_external_id: 'user-ext-1' });
        expect(result).toEqual([]);
    });
});

describe('membershipService - revokeMembership', () => {
    test('returns revoked member on success', async () => {
        mockAxios.patch.mockResolvedValueOnce({ data: { ...mockMember, status: 'REVOKED' } });
        const result = await revokeMembership(2, 1);
        expect(result).toEqual(expect.objectContaining({ status: 'REVOKED' }));
    });
});

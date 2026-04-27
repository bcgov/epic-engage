import '@testing-library/jest-dom';
import axios from 'axios';
import { setupEnv } from '../components/setEnvVars';
import {
    getEmailVerification,
    verifyEmailVerification,
    createEmailVerification,
    createSubscribeEmailVerification,
} from 'services/emailVerificationService';
import { EmailVerificationType } from 'models/emailVerification';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockEmailVerification = {
    id: 1,
    email_address: 'test@example.com',
    survey_id: 1,
    engagement_id: 1,
    verification_token: 'test-token',
    is_active: true,
};

beforeEach(() => {
    setupEnv();
    jest.clearAllMocks();
});

describe('emailVerificationService - getEmailVerification', () => {
    test('returns verification on success', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: mockEmailVerification });
        const result = await getEmailVerification('test-token');
        expect(result).toEqual(mockEmailVerification);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: null });
        await expect(getEmailVerification('test-token')).rejects.toEqual('Failed to fetch email verification');
    });

    test('rejects immediately when token is empty', async () => {
        await expect(getEmailVerification('')).rejects.toEqual('Invalid Token');
        expect(mockAxios.get).not.toHaveBeenCalled();
    });
});

describe('emailVerificationService - verifyEmailVerification', () => {
    test('returns verified verification on success', async () => {
        mockAxios.put.mockResolvedValueOnce({ data: mockEmailVerification });
        const result = await verifyEmailVerification('test-token');
        expect(result).toEqual(mockEmailVerification);
    });

    test('rejects when response.data is null', async () => {
        mockAxios.put.mockResolvedValueOnce({ data: null });
        await expect(verifyEmailVerification('test-token')).rejects.toEqual('Failed to fetch email verification');
    });

    test('rejects immediately when token is empty', async () => {
        await expect(verifyEmailVerification('')).rejects.toEqual('Invalid Token');
        expect(mockAxios.put).not.toHaveBeenCalled();
    });
});

describe('emailVerificationService - createEmailVerification', () => {
    test('returns created verification on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockEmailVerification });
        const result = await createEmailVerification({
            email_address: 'test@example.com',
            survey_id: 1,
            type: EmailVerificationType.Survey,
        });
        expect(result).toEqual(mockEmailVerification);
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.post.mockRejectedValueOnce(error);
        await expect(
            createEmailVerification({
                email_address: 'test@example.com',
                survey_id: 1,
                type: EmailVerificationType.Survey,
            }),
        ).rejects.toEqual(error);
    });
});

describe('emailVerificationService - createSubscribeEmailVerification', () => {
    test('returns created subscribe verification on success', async () => {
        mockAxios.post.mockResolvedValueOnce({ data: mockEmailVerification });
        const result = await createSubscribeEmailVerification(
            { email_address: 'test@example.com', survey_id: 1, type: EmailVerificationType.Survey },
            'EMAIL_LIST',
        );
        expect(result).toEqual(mockEmailVerification);
    });

    test('rejects on network error', async () => {
        const error = new Error('Network error');
        mockAxios.post.mockRejectedValueOnce(error);
        await expect(
            createSubscribeEmailVerification(
                { email_address: 'test@example.com', survey_id: 1, type: EmailVerificationType.Survey },
                'EMAIL_LIST',
            ),
        ).rejects.toEqual(error);
    });
});

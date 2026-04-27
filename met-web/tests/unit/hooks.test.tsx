import '@testing-library/jest-dom';
import { renderHook, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React, { ReactNode } from 'react';

// Mock dependencies before importing hooks
const mockRecordAnalytics = jest.fn();

jest.mock('@epic/centre-analytics', () => ({
    recordAnalytics: (...args: unknown[]) => mockRecordAnalytics(...args),
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en' },
    }),
}));

jest.mock('config', () => ({
    AppConfig: {
        centreApiUrl: 'https://centre-api.example.com',
        tenant: {
            defaultTenant: 'default-tenant',
        },
    },
}));

// Import hooks after mocks are set up
import { useAppTranslation, useRecordAnalyticsWithRetry } from 'hooks';

// Create a mock store for testing
const createMockStore = (initialState = {}) => {
    return configureStore({
        reducer: {
            user: (state = initialState) => state,
        },
        preloadedState: {
            user: initialState,
        },
    });
};

// Wrapper component for hooks that need Redux
const createWrapper = (store: ReturnType<typeof createMockStore>) => {
    return function Wrapper({ children }: { children: ReactNode }) {
        return <Provider store={store}>{children}</Provider>;
    };
};

describe('Hooks - useAppTranslation', () => {
    const originalSessionStorage = window.sessionStorage;
    let mockSessionStorage: { [key: string]: string };

    beforeEach(() => {
        mockSessionStorage = {};
        Object.defineProperty(window, 'sessionStorage', {
            value: {
                getItem: jest.fn((key: string) => mockSessionStorage[key] || null),
                setItem: jest.fn((key: string, value: string) => {
                    mockSessionStorage[key] = value;
                }),
                removeItem: jest.fn(),
                clear: jest.fn(),
            },
            writable: true,
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'sessionStorage', {
            value: originalSessionStorage,
            writable: true,
        });
    });

    test('returns translation function with tenant prefix from sessionStorage', () => {
        mockSessionStorage['tenantId'] = 'my-tenant';

        const { result } = renderHook(() => useAppTranslation());

        const translatedKey = result.current.t('someKey');
        expect(translatedKey).toBe('my-tenant:someKey');
    });

    test('uses default tenant when sessionStorage is empty', () => {
        // sessionStorage has no tenantId

        const { result } = renderHook(() => useAppTranslation());

        const translatedKey = result.current.t('someKey');
        expect(translatedKey).toBe('default-tenant:someKey');
    });

    test('returns all properties from useTranslation', () => {
        const { result } = renderHook(() => useAppTranslation());

        expect(result.current.t).toBeDefined();
        expect(result.current.i18n).toBeDefined();
    });
});

describe('Hooks - useRecordAnalyticsWithRetry', () => {
    const originalConsoleLog = console.log;

    beforeEach(() => {
        jest.useFakeTimers();
        mockRecordAnalytics.mockReset();
        console.log = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
        console.log = originalConsoleLog;
    });

    test('does not call recordAnalytics when user is not logged in', () => {
        const store = createMockStore({
            authentication: { authenticated: false },
            bearerToken: null,
            userDetail: null,
        });

        renderHook(() => useRecordAnalyticsWithRetry(), {
            wrapper: createWrapper(store),
        });

        expect(mockRecordAnalytics).not.toHaveBeenCalled();
    });

    test('does not call recordAnalytics when bearerToken is missing', () => {
        const store = createMockStore({
            authentication: { authenticated: true },
            bearerToken: null,
            userDetail: { preferred_username: 'testuser', sub: 'user-123' },
        });

        renderHook(() => useRecordAnalyticsWithRetry(), {
            wrapper: createWrapper(store),
        });

        expect(mockRecordAnalytics).not.toHaveBeenCalled();
    });

    test('does not call recordAnalytics when userDetail is missing', () => {
        const store = createMockStore({
            authentication: { authenticated: true },
            bearerToken: 'valid-token',
            userDetail: null,
        });

        renderHook(() => useRecordAnalyticsWithRetry(), {
            wrapper: createWrapper(store),
        });

        expect(mockRecordAnalytics).not.toHaveBeenCalled();
    });

    test('calls recordAnalytics when user is authenticated with valid token and details', async () => {
        mockRecordAnalytics.mockResolvedValueOnce(undefined);

        const store = createMockStore({
            authentication: { authenticated: true },
            bearerToken: 'valid-token',
            userDetail: { preferred_username: 'testuser', sub: 'user-123' },
        });

        renderHook(() => useRecordAnalyticsWithRetry(), {
            wrapper: createWrapper(store),
        });

        await waitFor(() => {
            expect(mockRecordAnalytics).toHaveBeenCalledTimes(1);
        });

        expect(mockRecordAnalytics).toHaveBeenCalledWith({
            appName: 'epic_engage',
            centreApiUrl: 'https://centre-api.example.com',
            enabled: true,
            authState: {
                user: {
                    access_token: 'valid-token',
                    profile: {
                        preferred_username: 'testuser',
                        sub: 'user-123',
                    },
                },
                isAuthenticated: true,
            },
        });
    });

    test('retries on failure up to maxRetries', async () => {
        mockRecordAnalytics
            .mockRejectedValueOnce(new Error('Network error'))
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce(undefined);

        const store = createMockStore({
            authentication: { authenticated: true },
            bearerToken: 'valid-token',
            userDetail: { preferred_username: 'testuser', sub: 'user-123' },
        });

        renderHook(() => useRecordAnalyticsWithRetry(3, 100), {
            wrapper: createWrapper(store),
        });

        // First call fails immediately
        await waitFor(() => {
            expect(mockRecordAnalytics).toHaveBeenCalledTimes(1);
        });

        // Advance timers for retry delay
        await act(async () => {
            jest.advanceTimersByTime(100);
        });

        await waitFor(() => {
            expect(mockRecordAnalytics).toHaveBeenCalledTimes(2);
        });

        // Advance timers for second retry delay
        await act(async () => {
            jest.advanceTimersByTime(100);
        });

        await waitFor(() => {
            expect(mockRecordAnalytics).toHaveBeenCalledTimes(3);
        });
    });

    test('logs error after max retries exhausted', async () => {
        const error = new Error('Persistent network error');
        mockRecordAnalytics.mockRejectedValue(error);

        const store = createMockStore({
            authentication: { authenticated: true },
            bearerToken: 'valid-token',
            userDetail: { preferred_username: 'testuser', sub: 'user-123' },
        });

        renderHook(() => useRecordAnalyticsWithRetry(2, 50), {
            wrapper: createWrapper(store),
        });

        // First attempt
        await waitFor(() => {
            expect(mockRecordAnalytics).toHaveBeenCalledTimes(1);
        });

        // Advance through all retries
        await act(async () => {
            jest.advanceTimersByTime(50);
        });

        await waitFor(() => {
            expect(mockRecordAnalytics).toHaveBeenCalledTimes(2);
        });

        // Allow final catch to execute
        await act(async () => {
            jest.runAllTimers();
        });

        await waitFor(() => {
            expect(console.log).toHaveBeenCalledWith('Failed to record analytics after retries:', expect.any(Error));
        });
    });
});

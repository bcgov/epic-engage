import '@testing-library/jest-dom';
import { replaceUrl, replaceAllInURL, getBaseUrl, filterQueryParams, levenshteinDistance } from 'utils/helpers/index';

// Mock AppConfig
jest.mock('config', () => ({
    AppConfig: {
        publicUrl: 'https://example.com',
    },
}));

describe('Utils/Helpers - replaceUrl', () => {
    test('replaces single placeholder in URL', () => {
        const url = '/api/engagements/:id/surveys';
        const result = replaceUrl(url, ':id', '123');
        expect(result).toBe('/api/engagements/123/surveys');
    });

    test('replaces first occurrence only', () => {
        const url = '/api/:id/items/:id';
        const result = replaceUrl(url, ':id', '456');
        expect(result).toBe('/api/456/items/:id');
    });

    test('returns original URL when key not found', () => {
        const url = '/api/engagements/list';
        const result = replaceUrl(url, ':missing', '123');
        expect(result).toBe('/api/engagements/list');
    });
});

describe('Utils/Helpers - replaceAllInURL', () => {
    test('replaces single parameter', () => {
        const result = replaceAllInURL({
            URL: '/api/engagements/:engagementId',
            params: { ':engagementId': '100' },
        });
        expect(result).toBe('/api/engagements/100');
    });

    test('replaces multiple parameters', () => {
        const result = replaceAllInURL({
            URL: '/api/engagements/:engagementId/surveys/:surveyId/submissions/:submissionId',
            params: {
                ':engagementId': '100',
                ':surveyId': '200',
                ':submissionId': '300',
            },
        });
        expect(result).toBe('/api/engagements/100/surveys/200/submissions/300');
    });

    test('replaces all occurrences of same parameter', () => {
        const result = replaceAllInURL({
            URL: '/api/:id/items/:id/details/:id',
            params: { ':id': '999' },
        });
        expect(result).toBe('/api/999/items/999/details/999');
    });

    test('handles empty params object by returning original URL unchanged', () => {
        const url = '/api/engagements/:id';
        expect(() => replaceAllInURL({ URL: url, params: {} })).not.toThrow();
    });

    test('regex matching uses provided keys as-is (lookup is case-sensitive)', () => {
    const result = replaceAllInURL({
        URL: '/api/:id/items/:id',
        params: { ':id': '123' },
    });
    expect(result).toBe('/api/123/items/123');
});
});

describe('Utils/Helpers - getBaseUrl', () => {
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
                removeItem: jest.fn((key: string) => {
                    delete mockSessionStorage[key];
                }),
                clear: jest.fn(() => {
                    mockSessionStorage = {};
                }),
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

    test('returns publicUrl when no basename in sessionStorage', () => {
        const result = getBaseUrl();
        expect(result).toBe('https://example.com');
    });

    test('returns publicUrl with basename when set in sessionStorage', () => {
        mockSessionStorage['basename'] = 'tenant1';
        const result = getBaseUrl();
        expect(result).toBe('https://example.com/tenant1');
    });
});

describe('Utils/Helpers - filterQueryParams', () => {
    test('removes null values', () => {
        const params = { a: 'value', b: null, c: 'test' };
        const result = filterQueryParams(params);
        expect(result).toEqual({ a: 'value', c: 'test' });
    });

    test('removes undefined values', () => {
        const params = { a: 'value', b: undefined, c: 'test' };
        const result = filterQueryParams(params);
        expect(result).toEqual({ a: 'value', c: 'test' });
    });

    test('removes empty string values', () => {
        const params = { a: 'value', b: '', c: 'test' };
        const result = filterQueryParams(params);
        expect(result).toEqual({ a: 'value', c: 'test' });
    });

    test('removes zero values (falsy)', () => {
        const params = { a: 'value', b: 0, c: 'test' };
        const result = filterQueryParams(params);
        expect(result).toEqual({ a: 'value', c: 'test' });
    });

    test('keeps truthy values including numbers and booleans', () => {
        const params = { a: 'value', b: 123, c: true, d: false };
        const result = filterQueryParams(params);
        // false is falsy, so it gets removed
        expect(result).toEqual({ a: 'value', b: 123, c: true });
    });

    test('returns empty object when all values are falsy', () => {
        const params = { a: null, b: undefined, c: '', d: 0 };
        const result = filterQueryParams(params);
        expect(result).toEqual({});
    });

    test('returns copy of object when all values are truthy', () => {
        const params = { a: 'value', b: 123 };
        const result = filterQueryParams(params);
        expect(result).toEqual({ a: 'value', b: 123 });
        expect(result).not.toBe(params); // Should be a new object
    });
});

describe('Utils/Helpers - levenshteinDistance', () => {
    test('returns 0 for identical strings', () => {
        expect(levenshteinDistance('hello', 'hello')).toBe(0);
        expect(levenshteinDistance('', '')).toBe(0);
    });

    test('returns length of other string when one is empty', () => {
        expect(levenshteinDistance('hello', '')).toBe(5);
        expect(levenshteinDistance('', 'world')).toBe(5);
    });

    test('returns 1 for single character difference (substitution)', () => {
        expect(levenshteinDistance('cat', 'bat')).toBe(1);
        expect(levenshteinDistance('hello', 'hallo')).toBe(1);
    });

    test('returns 1 for single character insertion', () => {
        expect(levenshteinDistance('cat', 'cats')).toBe(1);
        expect(levenshteinDistance('hell', 'hello')).toBe(1);
    });

    test('returns 1 for single character deletion', () => {
        expect(levenshteinDistance('cats', 'cat')).toBe(1);
        expect(levenshteinDistance('hello', 'hell')).toBe(1);
    });

    test('calculates correct distance for multiple edits', () => {
        expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
        expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
    });

    test('returns full length for completely different strings', () => {
        expect(levenshteinDistance('abc', 'xyz')).toBe(3);
    });

    test('handles case sensitivity', () => {
        expect(levenshteinDistance('Hello', 'hello')).toBe(1);
        expect(levenshteinDistance('HELLO', 'hello')).toBe(5);
    });

    test('handles strings with spaces', () => {
        expect(levenshteinDistance('hello world', 'hello_world')).toBe(1);
    });

    test('is symmetric', () => {
        expect(levenshteinDistance('abc', 'def')).toBe(levenshteinDistance('def', 'abc'));
        expect(levenshteinDistance('kitten', 'sitting')).toBe(levenshteinDistance('sitting', 'kitten'));
    });
});

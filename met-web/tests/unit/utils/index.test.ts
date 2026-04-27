import '@testing-library/jest-dom';
import { hasKey, getErrorMessage, checkEmail, downloadFile, reorder, blobToFile } from 'utils/index';
import { AxiosResponse } from 'axios';

describe('Utils - hasKey', () => {
    test('returns true when object has the specified key', () => {
        const obj = { name: 'test', value: 123 };
        expect(hasKey(obj, 'name')).toBe(true);
        expect(hasKey(obj, 'value')).toBe(true);
    });

    test('returns false when object does not have the specified key', () => {
        const obj = { name: 'test' };
        expect(hasKey(obj, 'missing')).toBe(false);
    });

    test('returns false for null', () => {
        expect(hasKey(null, 'key')).toBe(false);
    });

    test('returns false for undefined', () => {
        expect(hasKey(undefined, 'key')).toBe(false);
    });

    test('returns false for non-object types', () => {
        expect(hasKey('string' as unknown, 'length')).toBe(false);
        expect(hasKey(123 as unknown, 'toString')).toBe(false);
    });

    test('handles symbol keys', () => {
        const sym = Symbol('test');
        const obj = { [sym]: 'value' };
        expect(hasKey(obj, sym)).toBe(true);
    });
});

describe('Utils - getErrorMessage', () => {
    test('returns message from Error instance', () => {
        const error = new Error('Test error message');
        expect(getErrorMessage(error)).toBe('Test error message');
    });

    test('returns string directly when given a string', () => {
        expect(getErrorMessage('Simple error')).toBe('Simple error');
    });

    test('converts number to string', () => {
        expect(getErrorMessage(404)).toBe('404');
    });

    test('converts object to string', () => {
        const obj = { code: 'ERR_001' };
        expect(getErrorMessage(obj)).toBe('[object Object]');
    });

    test('handles null', () => {
        expect(getErrorMessage(null)).toBe('null');
    });

    test('handles undefined', () => {
        expect(getErrorMessage(undefined)).toBe('undefined');
    });
});

describe('Utils - checkEmail', () => {
    test('returns true for valid email addresses', () => {
        expect(checkEmail('test@example.com')).toBe(true);
        expect(checkEmail('user.name@domain.org')).toBe(true);
        expect(checkEmail('user_name@sub.domain.com')).toBe(true);
        expect(checkEmail('user-name@domain.ca')).toBe(true);
    });

    test('returns false for invalid email addresses', () => {
        expect(checkEmail('invalid')).toBe(false);
        expect(checkEmail('invalid@')).toBe(false);
        expect(checkEmail('@domain.com')).toBe(false);
        expect(checkEmail('user@domain')).toBe(false);
        expect(checkEmail('user@.com')).toBe(false);
        expect(checkEmail('')).toBe(false);
    });

    test('returns false for emails with spaces', () => {
        expect(checkEmail('user @domain.com')).toBe(false);
        expect(checkEmail('user@ domain.com')).toBe(false);
    });
});

describe('Utils - downloadFile', () => {
    let mockClick: jest.Mock;
    let mockAppendChild: jest.SpyInstance;
    let mockRemoveChild: jest.SpyInstance;
    let mockCreateObjectURL: jest.SpyInstance;
    let mockRevokeObjectURL: jest.SpyInstance;
    let mockCreateElement: jest.SpyInstance;

    beforeEach(() => {
        global.URL.createObjectURL = jest.fn();
        global.URL.revokeObjectURL = jest.fn();

        mockClick = jest.fn();
        mockAppendChild = jest.spyOn(document.body, 'appendChild').mockImplementation(() => document.createElement('a'));
        mockRemoveChild = jest.spyOn(document.body, 'removeChild').mockImplementation(() => document.createElement('a'));
        mockCreateObjectURL = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/test-blob');
        mockRevokeObjectURL = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        mockCreateElement = jest.spyOn(document, 'createElement').mockReturnValue({
            href: '',
            setAttribute: jest.fn(),
            click: mockClick,
        } as unknown as HTMLAnchorElement);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('creates blob URL and triggers download', () => {
        const mockBlob = new Blob(['test data'], { type: 'text/plain' });
        const mockResponse: AxiosResponse<Blob> = {
            data: mockBlob,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as AxiosResponse['config'],
        };

        downloadFile(mockResponse, 'test-file.txt');

        expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
        expect(mockCreateElement).toHaveBeenCalledWith('a');
        expect(mockAppendChild).toHaveBeenCalled();
        expect(mockClick).toHaveBeenCalled();
    });

    test('throws error when filename is not provided', () => {
        const mockBlob = new Blob(['test data'], { type: 'text/plain' });
        const mockResponse: AxiosResponse<Blob> = {
            data: mockBlob,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as AxiosResponse['config'],
        };

        expect(() => downloadFile(mockResponse, '')).toThrow('Filename must be specified');
    });
});

describe('Utils - reorder', () => {
    test('moves item forward in the list', () => {
        const list = ['a', 'b', 'c', 'd'];
        const result = reorder(list, 0, 2);
        expect(result).toEqual(['b', 'c', 'a', 'd']);
    });

    test('moves item backward in the list', () => {
        const list = ['a', 'b', 'c', 'd'];
        const result = reorder(list, 3, 1);
        expect(result).toEqual(['a', 'd', 'b', 'c']);
    });

    test('returns same order when start equals end index', () => {
        const list = ['a', 'b', 'c'];
        const result = reorder(list, 1, 1);
        expect(result).toEqual(['a', 'b', 'c']);
    });

    test('does not mutate the original list', () => {
        const list = ['a', 'b', 'c'];
        const result = reorder(list, 0, 2);
        expect(list).toEqual(['a', 'b', 'c']);
        expect(result).not.toBe(list);
    });

    test('handles single item list', () => {
        const list = ['a'];
        const result = reorder(list, 0, 0);
        expect(result).toEqual(['a']);
    });

    test('works with objects', () => {
        const list = [{ id: 1 }, { id: 2 }, { id: 3 }];
        const result = reorder(list, 0, 2);
        expect(result).toEqual([{ id: 2 }, { id: 3 }, { id: 1 }]);
    });
});

describe('Utils - blobToFile', () => {
    test('converts blob to file with correct properties', () => {
        const blob = new Blob(['test content'], { type: 'text/plain' });
        const fileName = 'test-file.txt';

        const file = blobToFile(blob, fileName);

        expect(file).toBeDefined();
        expect(file.name).toBe(fileName);
        expect((file as Blob & { lastModifiedDate?: Date }).lastModifiedDate).toBeInstanceOf(Date);
    });

    test('preserves blob content', () => {
        const content = 'test content';
        const blob = new Blob([content], { type: 'text/plain' });

        const file = blobToFile(blob, 'test.txt');

        expect(file.size).toBe(blob.size);
        expect(file.type).toBe('text/plain');
    });

    test('handles empty blob', () => {
        const blob = new Blob([], { type: 'application/octet-stream' });

        const file = blobToFile(blob, 'empty.bin');

        expect(file.name).toBe('empty.bin');
        expect(file.size).toBe(0);
    });
});

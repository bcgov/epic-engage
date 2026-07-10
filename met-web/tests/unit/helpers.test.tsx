import { sanitizeUrl } from 'utils/helpers';

describe('sanitizeUrl', () => {
    it('allows http, https and mailto schemes', () => {
        expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
        expect(sanitizeUrl('https://example.com/x')).toBe('https://example.com/x');
        expect(sanitizeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    });

    it('allows relative urls (resolve to current origin)', () => {
        expect(sanitizeUrl('/documents/1')).toBe('/documents/1');
    });

    it('blocks dangerous schemes', () => {
        expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined();
        expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    });

    it('returns undefined for empty/invalid input', () => {
        expect(sanitizeUrl(undefined)).toBeUndefined();
        expect(sanitizeUrl('')).toBeUndefined();
    });
});

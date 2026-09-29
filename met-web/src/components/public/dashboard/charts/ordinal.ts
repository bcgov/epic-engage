const ORDINAL_SUFFIXES: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };

// Rank positions ('1', '2', ...) read as ordinals ("1st", "2nd"); anything non-integer passes through.
export const formatOrdinal = (value: string | number): string => {
    const n = Number(value);
    if (!Number.isInteger(n)) {
        return String(value);
    }
    const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ORDINAL_SUFFIXES[n % 10] ?? 'th';
    return `${n}${suffix}`;
};

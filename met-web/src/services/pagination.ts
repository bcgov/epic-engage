import { Page } from './type';

// The list endpoints cap a page at this many rows.
export const MAX_PAGE_SIZE = 100;

/**
 * Load every page of a list endpoint, for the selectors that filter their options in the
 * browser. Without this they would be silently cut off at the first page.
 */
export const fetchAllPages = async <T>(fetchPage: (page: number, size: number) => Promise<Page<T>>): Promise<T[]> => {
    const items: T[] = [];
    for (let page = 1; ; page++) {
        const result = await fetchPage(page, MAX_PAGE_SIZE);
        // A malformed page ends the walk rather than spinning this loop.
        if (!result?.items?.length) {
            return items;
        }
        items.push(...result.items);
        if (items.length >= result.total) {
            return items;
        }
    }
};

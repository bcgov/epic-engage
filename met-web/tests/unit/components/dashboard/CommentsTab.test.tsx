import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CommentsTab } from 'components/public/dashboard/comments/CommentsTab';
import * as useSurveyCommentsModule from 'components/public/dashboard/hooks/useSurveyComments';
import { openEngagement } from '../factory';
import { TypedSurveyData } from 'models/analytics/surveyResult';

jest.mock('components/public/dashboard/hooks/useSurveyComments');

const mockUseSurveyComments = useSurveyCommentsModule.useSurveyComments as jest.Mock;

const baseHookResult = {
    data: null,
    pages: null,
    conditionalLinks: {},
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
};

// jsdom has no IntersectionObserver - CommentsTab uses one to track the active TOC section.
// The stub records what got observed so tests can replay intersections through the callback.
interface FakeObserver {
    callback: IntersectionObserverCallback;
    targets: Element[];
}
const observers: FakeObserver[] = [];

const lastObserver = () => observers[observers.length - 1];

const reportIntersecting = (observer: FakeObserver, intersectingIds: string[]) =>
    act(() => {
        observer.callback(
            observer.targets.map((target) => ({
                target,
                isIntersecting: intersectingIds.includes(target.id),
            })) as unknown as IntersectionObserverEntry[],
            observer as unknown as IntersectionObserver,
        );
    });

beforeAll(() => {
    (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
        callback: IntersectionObserverCallback;
        targets: Element[] = [];

        constructor(callback: IntersectionObserverCallback) {
            this.callback = callback;
            observers.push(this);
        }
        observe(el: Element) {
            this.targets.push(el);
        }
        unobserve() {
            /* noop */
        }
        disconnect() {
            /* noop */
        }
    };
});

// One conditional follow-up asked once per matrix row - the only shape that gets sub-sections.
const FOLLOW_UP_QUESTION = 'Why is this component important to you?';

const groupedPage = {
    title: 'Valued Components',
    questions: [
        {
            label: FOLLOW_UP_QUESTION,
            position: 0,
            key: 'air',
            type: 'simpletextarea',
            result: [{ value: 'Dust concerns', count: 1 }],
        },
        {
            label: FOLLOW_UP_QUESTION,
            position: 1,
            key: 'water',
            type: 'simpletextarea',
            result: [{ value: 'Well contamination', count: 1 }],
        },
    ] as TypedSurveyData[],
    keys: ['air', 'water'],
};

const groupedConditionalLinks = {
    air: {
        trigger_key: 'valued-components',
        row_key: 'air',
        row_label: 'Air quality',
        trigger_values: ['very-important'],
        trigger_value_labels: ['Very important'],
    },
    water: {
        trigger_key: 'valued-components',
        row_key: 'water',
        row_label: 'Water quality',
        trigger_values: ['very-important'],
        trigger_value_labels: ['Very important'],
    },
};

const mockGroupedSurvey = () =>
    mockUseSurveyComments.mockReturnValue({
        ...baseHookResult,
        data: { data: groupedPage.questions },
        pages: [groupedPage],
        conditionalLinks: groupedConditionalLinks,
    });

describe('CommentsTab', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        observers.length = 0;
    });

    it('shows loading skeletons while loading', () => {
        mockUseSurveyComments.mockReturnValue({ ...baseHookResult, isLoading: true });
        const { container } = render(
            <CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />,
        );
        expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    });

    it('shows an error box and refetches on click', () => {
        const refetch = jest.fn();
        mockUseSurveyComments.mockReturnValue({ ...baseHookResult, isError: true, refetch });
        render(<CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        fireEvent.click(screen.getByRole('button'));
        expect(refetch).toHaveBeenCalled();
    });

    it('shows NoData when there is no comment data', () => {
        mockUseSurveyComments.mockReturnValue(baseHookResult);
        render(<CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);
        expect(screen.getByText(/no data/i)).toBeInTheDocument();
    });

    it('shows NoData when there is data but nothing is free-text (no sections)', () => {
        const radioQuestion: TypedSurveyData = {
            label: 'Pick one',
            position: 0,
            key: 'radio1',
            type: 'simpleradios',
            result: [{ value: 'yes', count: 1 }],
        };
        mockUseSurveyComments.mockReturnValue({ ...baseHookResult, data: { data: [radioQuestion] } });
        render(<CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);
        expect(screen.getByText(/no data/i)).toBeInTheDocument();
    });

    it('renders the sidebar TOC and comment sections, and navigating scrolls to the section', () => {
        const textQuestion: TypedSurveyData = {
            label: 'What did you think?',
            position: 0,
            key: 'text1',
            type: 'simpletextarea',
            result: [
                { value: 'Great project', count: 1 },
                { value: 'Loved it', count: 1 },
            ],
        };
        mockUseSurveyComments.mockReturnValue({
            ...baseHookResult,
            data: { data: [textQuestion] },
            pages: [{ title: '', questions: [textQuestion], keys: ['text1'] }],
        });

        const scrollIntoView = jest.fn();
        HTMLElement.prototype.scrollIntoView = scrollIntoView;

        render(<CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        expect(screen.getByText('All Comments')).toBeInTheDocument();
        expect(screen.getByText('Great project')).toBeInTheDocument();
        expect(screen.getByText('Loved it')).toBeInTheDocument();
        // question label appears both as the section heading and the sidebar TOC entry
        expect(screen.getAllByText('What did you think?').length).toBeGreaterThanOrEqual(2);

        fireEvent.click(screen.getByRole('button', { name: /what did you think\?/i }));
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });

    it('sums the comment count and the numbered page into one meta line under the question', () => {
        mockGroupedSurvey();

        render(<CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        expect(screen.getByText('2 comments · Page 1 – Valued Components')).toBeInTheDocument();
    });

    it('does not number a page whose title already carries its own number', () => {
        const textQuestion: TypedSurveyData = {
            label: 'Feedback',
            position: 0,
            key: 'text1',
            type: 'simpletextarea',
            result: [{ value: 'Good stuff', count: 1 }],
        };
        mockUseSurveyComments.mockReturnValue({
            ...baseHookResult,
            data: { data: [textQuestion] },
            pages: [{ title: 'Page 2', questions: [textQuestion], keys: ['text1'] }],
        });

        render(<CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        expect(screen.getByText('1 comment · Page 2')).toBeInTheDocument();
    });

    it('drops the page from the meta line when the survey is not a multi-page wizard', () => {
        const textQuestion: TypedSurveyData = {
            label: 'Feedback',
            position: 0,
            key: 'text1',
            type: 'simpletextarea',
            result: [{ value: 'Good stuff', count: 1 }],
        };
        mockUseSurveyComments.mockReturnValue({ ...baseHookResult, data: { data: [textQuestion] }, pages: null });

        render(<CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        // The fallback page has no title, so there is nothing to separate the count from.
        expect(screen.getByText('1 comment')).toBeInTheDocument();
    });

    it('tracks the sub-sections rather than their parent wrapper', () => {
        mockGroupedSurvey();

        render(<CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        // The section wrapper contains its sub-sections, so it would always be the topmost
        // intersecting element and no sub-section could ever become active.
        const observedIds = lastObserver().targets.map((target) => target.id);
        expect(observedIds).toEqual(['sub-air', 'sub-water']);
    });

    it('marks the active sub-section and keeps its parent section highlighted', () => {
        mockGroupedSurvey();

        render(<CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        reportIntersecting(lastObserver(), ['sub-water']);

        expect(screen.getByRole('button', { name: 'Water quality' })).toHaveAttribute('aria-current', 'location');
        expect(screen.getByRole('button', { name: /important to you/ })).toHaveAttribute('aria-current', 'location');
        expect(screen.getByRole('button', { name: 'Air quality' })).not.toHaveAttribute('aria-current');
    });

    it('holds the clicked entry active while the smooth scroll travels past other sections', () => {
        mockGroupedSurvey();
        HTMLElement.prototype.scrollIntoView = jest.fn();

        render(<CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        fireEvent.click(screen.getByRole('button', { name: 'Water quality' }));
        expect(screen.getByRole('button', { name: 'Water quality' })).toHaveAttribute('aria-current', 'location');

        // Sections swept past mid-scroll must not steal the highlight from the click target.
        reportIntersecting(lastObserver(), ['sub-air']);
        expect(screen.getByRole('button', { name: 'Water quality' })).toHaveAttribute('aria-current', 'location');
        expect(screen.getByRole('button', { name: 'Air quality' })).not.toHaveAttribute('aria-current');

        // Once the scroll lands on the target, tracking resumes.
        reportIntersecting(lastObserver(), ['sub-water']);
        reportIntersecting(lastObserver(), ['sub-air']);
        expect(screen.getByRole('button', { name: 'Air quality' })).toHaveAttribute('aria-current', 'location');
    });

    it('falls back to a single unnamed page when the survey is not a multi-page wizard', () => {
        const textQuestion: TypedSurveyData = {
            label: 'Feedback',
            position: 0,
            key: 'text1',
            type: 'simpletextarea',
            result: [{ value: 'Good stuff', count: 1 }],
        };
        // pages is null (non-wizard form) - CommentsTab should still group the flat data.data
        mockUseSurveyComments.mockReturnValue({ ...baseHookResult, data: { data: [textQuestion] }, pages: null });

        render(<CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        expect(screen.getByText('Good stuff')).toBeInTheDocument();
    });
});

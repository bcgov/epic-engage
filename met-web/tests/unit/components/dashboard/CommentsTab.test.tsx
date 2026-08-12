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

// Scrolls the page with the entries laid out at the given viewport offsets. jsdom lays nothing
// out on its own, so any entry the highlight could plausibly follow has to be placed by hand.
const BELOW_FOLD = 10000;

const scrollTo = (tops: Record<string, number>) => {
    document.querySelectorAll('[id^="section-"], [id^="sub-"]').forEach((el) => {
        const top = tops[el.id] ?? BELOW_FOLD;
        el.getBoundingClientRect = () => ({ top, bottom: top + 200, height: 200 }) as DOMRect;
    });
    act(() => {
        fireEvent.scroll(window);
    });
};

const activeEntry = () => screen.getByRole('button', { current: 'location' as unknown as boolean });

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

    it('highlights nothing until an entry is clicked', () => {
        mockGroupedSurvey();

        render(<CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        expect(screen.queryByRole('button', { current: 'location' as unknown as boolean })).not.toBeInTheDocument();
    });

    it('leaves the highlight where it was put when the reader scrolls', () => {
        mockGroupedSurvey();
        HTMLElement.prototype.scrollIntoView = jest.fn();

        render(<CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        fireEvent.click(screen.getByRole('button', { name: 'Water quality' }));
        // Scrolling anywhere, including right over another entry, is not a choice of entry.
        scrollTo({ 'section-air': -600, 'sub-air': 40, 'sub-water': 900 });

        expect(activeEntry()).toHaveAccessibleName('Water quality');
    });

    it('activates only the clicked sub-section, leaving its parent section alone', () => {
        mockGroupedSurvey();
        HTMLElement.prototype.scrollIntoView = jest.fn();

        render(<CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        fireEvent.click(screen.getByRole('button', { name: 'Water quality' }));

        expect(activeEntry()).toHaveAccessibleName('Water quality');
        expect(screen.getByRole('button', { name: /important to you/ })).not.toHaveAttribute('aria-current');
        expect(screen.getByRole('button', { name: 'Air quality' })).not.toHaveAttribute('aria-current');
    });

    it('activates only the clicked section, not the first question inside it', () => {
        mockGroupedSurvey();
        HTMLElement.prototype.scrollIntoView = jest.fn();

        render(<CommentsTab engagement={openEngagement} engagementIsLoading={false} dashboardType="public" />);

        fireEvent.click(screen.getByRole('button', { name: /important to you/ }));

        expect(activeEntry()).toHaveAccessibleName(/important to you/);
        expect(screen.getByRole('button', { name: 'Air quality' })).not.toHaveAttribute('aria-current');
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

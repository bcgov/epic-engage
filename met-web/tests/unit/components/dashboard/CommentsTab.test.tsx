import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
};

// jsdom has no IntersectionObserver - CommentsTab uses one to track the active TOC section.
beforeAll(() => {
    (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
        observe() {
            /* noop */
        }
        unobserve() {
            /* noop */
        }
        disconnect() {
            /* noop */
        }
    };
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

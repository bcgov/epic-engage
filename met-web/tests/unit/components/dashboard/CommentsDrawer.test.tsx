import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CommentsDrawer } from 'components/public/dashboard/charts/CommentsDrawer';

const sections = [
    { rowLabel: 'Air quality', question: 'Why is air quality important to you?', responses: ['Smoke', 'Dust'] },
    { rowLabel: 'Wildlife', question: 'Why is wildlife important to you?', responses: ['Caribou'] },
];

describe('CommentsDrawer', () => {
    it('lists a jump menu entry per section, and scrolls to the one clicked', () => {
        const scrollIntoView = jest.fn();
        HTMLElement.prototype.scrollIntoView = scrollIntoView;

        render(
            <CommentsDrawer
                open
                onClose={jest.fn()}
                question="How important are these to you?"
                responses={[]}
                sections={sections}
            />,
        );

        const menu = screen.getByRole('navigation', { name: /jump to a question/i });
        expect(menu).toHaveTextContent('Air quality (2 comments)');
        expect(menu).toHaveTextContent('Wildlife (1 comment)');

        const [airEntry, wildlifeEntry] = screen.getAllByRole('button', { name: /\(\d+ comments?\)/ });
        expect(airEntry).toHaveAttribute('aria-current');
        expect(wildlifeEntry).not.toHaveAttribute('aria-current');

        fireEvent.click(wildlifeEntry);

        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
        expect(wildlifeEntry).toHaveAttribute('aria-current');
        expect(airEntry).not.toHaveAttribute('aria-current');
    });

    it('totals the sections in the header count and keeps each section titled', () => {
        render(
            <CommentsDrawer
                open
                onClose={jest.fn()}
                question="How important are these to you?"
                responses={[]}
                sections={sections}
            />,
        );

        expect(screen.getByText('3 comments')).toBeInTheDocument();
        expect(screen.getByText('Why is air quality important to you?')).toBeInTheDocument();
        expect(screen.getByText('Smoke')).toBeInTheDocument();
        expect(screen.getByText('Caribou')).toBeInTheDocument();
    });

    it('shows no jump menu when there is nowhere else to jump to', () => {
        render(
            <CommentsDrawer
                open
                onClose={jest.fn()}
                question="Tell us more"
                responses={['A comment']}
                sections={[sections[0]]}
            />,
        );

        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });

    it('shows no jump menu for an ungrouped list of comments', () => {
        render(<CommentsDrawer open onClose={jest.fn()} question="Tell us more" responses={['A comment']} />);

        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
        expect(screen.getByText('A comment')).toBeInTheDocument();
    });
});

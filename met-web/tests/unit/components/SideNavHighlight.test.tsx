import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from 'redux/store';
import SideNav from 'components/shared/layout/SideNav/SideNav';
import { Palette } from 'styles/Theme';

// The survey results report is reachable from both the Surveys and the Engagements listing, and is
// served at a URL rooted in whichever one the user came from. SideNav highlights by longest path
// match, so the report inherits the right highlight purely from that URL shape — nothing in SideNav
// special-cases it. These tests pin that down, since re-rooting either report route would silently
// send the highlight back to the wrong nav item.
const renderAt = (path: string) =>
    render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[path]}>
                <SideNav open setOpen={() => undefined} isMediumScreen drawerWidth={280} />
            </MemoryRouter>
        </Provider>,
    );

const colorOf = (name: string) => {
    const label = screen.getByTestId(`SideNav/${name}-button`).querySelector('.MuiTypography-root');
    return window.getComputedStyle(label as Element).color;
};

// Palette.secondary.main as rgb(), which is what getComputedStyle returns.
const SELECTED = 'rgb(248, 187, 71)';
const UNSELECTED = 'white';

describe('SideNav highlight on the survey results report', () => {
    it('is a valid assumption that the selected colour is the theme secondary', () => {
        expect(Palette.secondary.main.toLowerCase()).toBe('#f8bb47');
    });

    it('highlights Surveys when the report was opened from the Surveys listing', () => {
        renderAt('/surveys/1/dashboard/internal');

        expect(colorOf('Surveys')).toBe(SELECTED);
        expect(colorOf('Engagements')).toBe(UNSELECTED);
    });

    it('highlights Engagements when the report was opened from the Engagements listing', () => {
        renderAt('/engagements/2/dashboard/internal');

        expect(colorOf('Engagements')).toBe(SELECTED);
        expect(colorOf('Surveys')).toBe(UNSELECTED);
    });
});

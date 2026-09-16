import { act, render, screen } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { Notification } from 'components/shared/common/Notifications/Notification';
import { openNotification } from 'services/notificationService/notificationSlice';
import { store } from 'redux/store';
import * as tokens from 'styles/designTokens';
import ProviderShell from './ProviderShell';
import { setupEnv } from './setEnvVars';

const hexToRgb = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return `rgb(${r}, ${g}, ${b})`;
};

jest.mock('@reduxjs/toolkit/query/react', () => ({
    ...jest.requireActual('@reduxjs/toolkit/query/react'),
    fetchBaseQuery: jest.fn(),
}));
test('render notification', async () => {
    setupEnv();
    render(
        <ProviderShell>
            <Notification />
        </ProviderShell>,
    );
});

test.each([
    ['success', tokens.supportSurfaceColorSuccessSubtle, tokens.iconsColorSuccess],
    ['warning', tokens.supportSurfaceColorWarning, tokens.supportBorderColorWarning],
    ['error', tokens.supportSurfaceColorDanger, tokens.supportBorderColorDanger],
] as const)('%s notification uses the B.C. Design System banner colours', (severity, surface, border) => {
    setupEnv();
    render(
        <ProviderShell>
            <Notification />
        </ProviderShell>,
    );

    act(() => {
        store.dispatch(openNotification({ severity, text: 'Message' }));
    });

    const style = window.getComputedStyle(screen.getByTestId('alert-notification'));
    expect(style.backgroundColor).toBe(hexToRgb(surface));
    expect(style.color).toBe(hexToRgb(tokens.typographyColorPrimary));
    expect(style.border).toBe(`1px solid ${border}`);
});

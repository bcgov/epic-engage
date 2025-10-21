import React from 'react';
import { BaseTheme } from 'styles/Theme';
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import { BrowserRouter as Router } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from 'redux/store';

type ProviderProps = {
    children: React.ReactNode;
};

function ProviderShell({ children }: ProviderProps) {
    return (
        <Router>
            <Provider store={store}>
                <ThemeProvider theme={BaseTheme}>
                    <StyledEngineProvider injectFirst>{children}</StyledEngineProvider>
                </ThemeProvider>
            </Provider>
        </Router>
    );
}

export default ProviderShell;

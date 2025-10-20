import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Provider } from 'react-redux';
import { store } from './redux/store';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { BaseTheme } from 'styles/Theme';
import { Formio } from '@formio/react';
import MetFormioComponents from 'met-formio';
import '@bcgov/bc-sans/css/BCSans.css';
import { HelmetProvider } from 'react-helmet-async';

Formio.use(MetFormioComponents);
Formio.Utils.Evaluator.noeval = false;

const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <HelmetProvider>
        <Provider store={store}>
            <ThemeProvider theme={BaseTheme}>
                <StyledEngineProvider injectFirst>{children}</StyledEngineProvider>
            </ThemeProvider>
        </Provider>
    </HelmetProvider>
);

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

const root = ReactDOM.createRoot(container);
root.render(
    <React.StrictMode>
        <AppProviders>
            <App />
        </AppProviders>
    </React.StrictMode>,
);

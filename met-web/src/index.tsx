import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Provider } from 'react-redux';
import { store } from './redux/store';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { BaseTheme } from 'styles/Theme';
import { Formio } from '@formio/js';
import '@bcgov/bc-sans/css/BCSans.css';
import { HelmetProvider } from 'react-helmet-async';

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

async function main() {
    // Dynamic import ensures @formio/js (and its built-in component registrations) fully
    // initializes before met-formio's module bodies run. met-formio component files access
    // Components.components.textfield at evaluation time — if it lands in the same chunk as
    // @formio/js the whole chunk evaluates together and there is no safe ordering; keeping it
    // in a separate chunk and importing it dynamically guarantees the registry is populated.
    const { default: MetFormioComponents } = await import('met-formio/lib/index.js');
    Formio.use(MetFormioComponents);

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
}

main();

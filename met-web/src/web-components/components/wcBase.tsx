import React from 'react';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { ThemeProvider } from '@mui/material/styles';
import { Provider } from 'react-redux';
import ReactDOM from 'react-dom/client';
import createWcTheme from '../styles/wcTheme';
import { store } from '../../store';
import { ConvertedProp, EventMap } from '../types/web-component-types';

class WCBaseELement extends HTMLElement {
    ComponentToMount: React.ComponentType;
    root: ReactDOM.Root | null = null;
    observer: MutationObserver;
    shadowContainer: ShadowRoot | null = null;
    constructor(componentToMount: React.ComponentType) {
        super();
        this.ComponentToMount = componentToMount;
        this.observer = new MutationObserver(() => this.update());
        this.observer.observe(this, { attributes: true });
    }
    connectedCallback() {
        this.shadowContainer = this.attachShadow({ mode: 'open' });

        this.mount();
    }

    disconnectedCallback() {
        this.unmount();
        this.observer.disconnect();
    }

    mount() {
        console.log('Mounting the component');
        const ComponentToMount: React.ComponentType = this.ComponentToMount;
        const emotionRoot = document.createElement('style');
        const shadowRootElement = document.createElement('div');
        if (this.shadowContainer) {
            this.shadowContainer.appendChild(emotionRoot);
            this.shadowContainer.appendChild(shadowRootElement);
        }

        const cache = createCache({
            key: 'css',
            prepend: true,
            container: emotionRoot,
        });
        const shadowTheme = createWcTheme(shadowRootElement);
        this.root = ReactDOM.createRoot(shadowRootElement);
        const props = {
            ...this.getProps(this.attributes),
            ...this.getEvents(),
        };
        this.root.render(
            <React.StrictMode>
                <Provider store={store}>
                    <CacheProvider value={cache}>
                        <ThemeProvider theme={shadowTheme}>
                            <ComponentToMount {...props} />
                        </ThemeProvider>
                    </CacheProvider>
                </Provider>
            </React.StrictMode>,
        );
    }

    unmount() {
        console.log('Performing unmount');
        this.root?.unmount();
    }

    update() {
        console.log('Updating attribute');
        this.unmount();
        this.mount();
    }
    getProps(attributes: NamedNodeMap) {
        return [...attributes]
            .filter((attr) => attr.name !== 'style')
            .map((attr) => this.convert(attr.name, attr.value))
            .reduce((props, prop) => ({ ...props, [prop.name]: prop.value }), {});
    }
    getEvents(): EventMap {
        return Object.values(this.attributes)
            .filter((attr) => /on([a-z].*)/.exec(attr.name))
            .reduce((events: EventMap, ev) => {
                events[ev.name] = (args?: Record<string, unknown>) =>
                    this.dispatchEvent(new CustomEvent(ev.name, { detail: args }));
                return events;
            }, {});
    }
    convert(attrName: string, attrValue: string): ConvertedProp {
        let value: string | number | boolean | object = attrValue;

        if (attrValue === 'true' || attrValue === 'false') {
            value = attrValue === 'true';
        } else if (!isNaN(Number(attrValue)) && attrValue !== '') {
            value = Number(attrValue);
        } else if (/^{.*}/.test(attrValue)) {
            try {
                value = JSON.parse(attrValue);
            } catch {
                // fallback to string if JSON parse fails
                value = attrValue;
            }
        }

        return { name: attrName, value };
    }
}

export default WCBaseELement;

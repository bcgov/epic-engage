import React from 'react';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { ThemeProvider } from '@mui/material/styles';
import { Provider } from 'react-redux';
import ReactDOM from 'react-dom/client';
import { EngagementBanner } from '../../components/engagement/view/EngagementBanner/StandAloneBanner';
import createWcTheme from '../styles/wcTheme';
import { store } from '../../store';
import { PrimaryButton } from 'components/common';
import { Grid } from '@mui/material';
import { ConvertedProp, EventMap } from '../types/web-component-types';

export default class EngagementBannerWC extends HTMLElement {
    root: ReactDOM.Root | undefined;
    observer: MutationObserver;
    shadowContainer: ShadowRoot | undefined;
    constructor(componentToMount: React.ComponentType) {
        super();
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
        const props: Record<string, string | number | boolean | object> = {
            ...this.getProps(this.attributes),
            ...this.getEvents(),
        };
        this.root.render(
            <React.StrictMode>
                <Provider store={store}>
                    <CacheProvider value={cache}>
                        <ThemeProvider theme={shadowTheme}>
                            <EngagementBanner
                                surveyButton={
                                    <Grid
                                        item
                                        container
                                        direction={{ xs: 'column', sm: 'row' }}
                                        xs={12}
                                        justifyContent="flex-end"
                                    >
                                        <PrimaryButton
                                            onClick={() => {
                                                const url =
                                                    typeof props['engagementurl'] === 'string'
                                                        ? props['engagementurl']
                                                        : '';
                                                window.open(url, '_blank');
                                            }}
                                        >
                                            View Engagement
                                        </PrimaryButton>
                                    </Grid>
                                }
                                engagementSlug={
                                    typeof props['engagementurl'] === 'string'
                                        ? this._getSlugFromUrl(props['engagementurl'])
                                        : ''
                                }
                                {...props}
                            />
                        </ThemeProvider>
                    </CacheProvider>
                </Provider>
            </React.StrictMode>,
        );
    }

    unmount() {
        this.root?.unmount();
    }

    update() {
        this.unmount();
        this.mount();
    }
    getProps(attributes: NamedNodeMap): Record<string, string | number | boolean | object> {
        return [...attributes]
            .filter((attr) => attr.name !== 'style')
            .map((attr) => this.convert(attr.name, attr.value))
            .reduce((props, prop) => ({ ...props, [prop.name]: prop.value }), {});
    }
    getEvents(): EventMap {
        return Object.values(this.attributes)
            .filter((attr) => /on([a-z].*)/.test(attr.name))
            .reduce((events: EventMap, ev) => {
                events[ev.name] = (args: Record<string, unknown> = {}) =>
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
                value = attrValue; // fallback
            }
        }

        return { name: attrName, value };
    }
    _getSlugFromUrl(url: string) {
        return url.substring(url.lastIndexOf('/') + 1, url.length);
    }
}

customElements.define('engagement-banner-wc', EngagementBannerWC);

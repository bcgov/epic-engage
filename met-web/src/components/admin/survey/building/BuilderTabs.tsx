import React, { useRef } from 'react';
import { styled } from '@mui/system';

export interface BuilderTab {
    value: string;
    label: string;
    icon: React.ReactNode;
}

const TabBarContainer = styled('div')({
    display: 'flex',
    alignItems: 'flex-end',
    gap: 0,
    padding: '8px 24px 0',
    background: 'none',
    borderBottom: '1px solid #D8D8D8',
    width: '100%',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
    // keep horizontal scroll on small widths but hide the scrollbar
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': { display: 'none' },
});

const TabButton = styled('button')({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    border: 'none',
    borderBottom: '3px solid transparent',
    background: 'none',
    fontFamily: 'inherit',
    fontSize: '16px',
    fontWeight: 400,
    color: '#474543',
    cursor: 'pointer',
    transition: 'all 0.15s',
    marginBottom: '-1px',
    flexShrink: 0,
    '& svg': {
        fontSize: '16px',
    },
    '&:hover': {
        color: '#013366',
        fontWeight: 700,
    },
    '&.active': {
        color: '#013366',
        fontWeight: 700,
        borderBottomColor: '#013366',
    },
    '&:focus-visible': {
        outline: '2px solid #013366',
        outlineOffset: '2px',
    },
});

export const tabIds = (value: string) => ({ tab: `${value}-tab`, panel: `${value}-panel` });

export const BuilderTabs = ({
    tabs,
    value,
    onChange,
}: {
    tabs: BuilderTab[];
    value: string;
    onChange: (value: string) => void;
}) => {
    const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
        let nextIndex: number | null = null;
        switch (event.key) {
            case 'ArrowRight':
                nextIndex = (index + 1) % tabs.length;
                break;
            case 'ArrowLeft':
                nextIndex = (index - 1 + tabs.length) % tabs.length;
                break;
            case 'Home':
                nextIndex = 0;
                break;
            case 'End':
                nextIndex = tabs.length - 1;
                break;
            default:
                return;
        }
        event.preventDefault();
        onChange(tabs[nextIndex].value);
        buttonRefs.current[nextIndex]?.focus();
    };

    return (
        <TabBarContainer role="tablist">
            {tabs.map((tab, index) => {
                const active = tab.value === value;
                const ids = tabIds(tab.value);
                return (
                    <TabButton
                        key={tab.value}
                        ref={(el) => (buttonRefs.current[index] = el)}
                        type="button"
                        role="tab"
                        id={ids.tab}
                        aria-controls={ids.panel}
                        aria-selected={active}
                        tabIndex={active ? 0 : -1}
                        className={active ? 'active' : ''}
                        onClick={() => onChange(tab.value)}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                    >
                        {tab.icon}
                        {tab.label}
                    </TabButton>
                );
            })}
        </TabBarContainer>
    );
};

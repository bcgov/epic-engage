import React, { useRef } from 'react';
import { styled } from '@mui/system';
import { Palette } from 'styles/Theme';

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
    borderBottom: `1px solid ${Palette.border.default}`,
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
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    fontSize: '16px',
    fontWeight: 400,
    color: Palette.text.secondary,
    cursor: 'pointer',
    transition: 'all 0.15s',
    marginBottom: '-1px',
    flexShrink: 0,
    '& svg': {
        fontSize: '16px',
    },
    '&:hover': {
        color: Palette.primary.main,
        fontWeight: 700,
        backgroundColor: 'transparent',
    },
    '&.active': {
        color: Palette.primary.main,
        fontWeight: 700,
        borderBottomColor: Palette.primary.main,
    },
    '&:focus-visible': {
        outline: `2px solid ${Palette.primary.main}`,
        outlineOffset: '2px',
        backgroundColor: 'transparent',
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

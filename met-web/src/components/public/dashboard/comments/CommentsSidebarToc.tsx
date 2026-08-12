import { useEffect, useRef, useState } from 'react';
import { Box, Link } from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { CommentSection } from './buildCommentSections';
import { Palette } from 'styles/Theme';

interface CommentsSidebarTocProps {
    sections: CommentSection[];
    activeId: string | null;
    onNavigate: (id: string) => void;
}

const SCROLL_PADDING = 8;

export const CommentsSidebarToc = ({ sections, activeId, onNavigate }: CommentsSidebarTocProps) => {
    const [collapsed, setCollapsed] = useState(false);
    const listRef = useRef<HTMLDivElement | null>(null);
    const activeEntryRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        const list = listRef.current;
        const entry = activeEntryRef.current;
        if (!list || !entry) {
            return;
        }
        const entryTop = entry.offsetTop;
        const entryBottom = entryTop + entry.offsetHeight;
        if (entryTop < list.scrollTop) {
            list.scrollTop = entryTop - SCROLL_PADDING;
        } else if (entryBottom > list.scrollTop + list.clientHeight) {
            list.scrollTop = entryBottom - list.clientHeight + SCROLL_PADDING;
        }
    }, [activeId]);

    return (
        <Box
            component="aside"
            sx={{
                width: 260,
                flexShrink: 0,
                position: 'sticky',
                // Pin below the app bar rather than under it, and never grow past the viewport -
                // the list scrolls internally so entry 1 stays one click away however far down the
                // comments are scrolled.
                top: 'calc(var(--comments-sticky-top, 0px) + 20px)',
                maxHeight: 'calc(100vh - var(--comments-sticky-top, 0px) - 40px)',
                display: 'flex',
                flexDirection: 'column',
                mr: '28px',
            }}
        >
            <Box
                component="button"
                onClick={() => setCollapsed((prev) => !prev)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                    width: '100%',
                    backgroundColor: Palette.primary.main,
                    color: Palette.background.default,
                    border: 'none',
                    borderRadius: collapsed ? '6px' : '6px 6px 0 0',
                    padding: '10px 14px',
                    fontFamily: 'inherit',
                    fontSize: '13px',
                    fontWeight: 700,
                    lineHeight: 1.4,
                    cursor: 'pointer',
                }}
            >
                <span>List of comments</span>
                {collapsed ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
            </Box>
            {!collapsed && (
                <Box
                    ref={listRef}
                    sx={{
                        backgroundColor: Palette.background.offWhite,
                        border: `1px solid ${Palette.border.default}`,
                        borderTop: 'none',
                        borderRadius: '0 0 6px 6px',
                        padding: '8px 0 12px',
                        position: 'relative',
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                    }}
                >
                    {sections.map((section, index) => {
                        const sectionActive = section.id === activeId;
                        return (
                            <Box key={section.id} sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Link
                                    component="button"
                                    type="button"
                                    ref={activeId === section.id ? activeEntryRef : null}
                                    onClick={() => onNavigate(section.id)}
                                    aria-current={sectionActive ? 'location' : undefined}
                                    underline="none"
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'baseline',
                                        gap: '8px',
                                        fontSize: '13px',
                                        textAlign: 'left',
                                        padding: '5px 14px',
                                        lineHeight: 1.4,
                                        borderLeft: '3px solid transparent',
                                        ...(sectionActive && {
                                            backgroundColor: Palette.background.paleBlue,
                                            borderLeftColor: Palette.primary.main,
                                            color: Palette.primary.main,
                                            fontWeight: 700,
                                        }),
                                    }}
                                >
                                    <Box
                                        component="span"
                                        sx={{
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            lineHeight: 1.4,
                                            color: Palette.text.disabled,
                                            minWidth: '16px',
                                            flexShrink: 0,
                                        }}
                                    >
                                        {index + 1}
                                    </Box>
                                    <Box component="span" sx={{ flex: 1, fontSize: '12px', lineHeight: 1.4 }}>
                                        {section.title}
                                    </Box>
                                </Link>
                                {section.subSections && (
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            ml: '23px',
                                            mr: '14px',
                                            mb: '4px',
                                            borderLeft: `2px solid ${Palette.border.default}`,
                                        }}
                                    >
                                        {section.subSections.map((sub) => (
                                            <Link
                                                key={sub.id}
                                                component="button"
                                                type="button"
                                                ref={activeId === sub.id ? activeEntryRef : null}
                                                onClick={() => onNavigate(sub.id)}
                                                aria-current={activeId === sub.id ? 'location' : undefined}
                                                underline="none"
                                                // Same active treatment as a section entry
                                                sx={{
                                                    fontSize: '12px',
                                                    lineHeight: 1.4,
                                                    textAlign: 'left',
                                                    padding: '3px 6px 3px 14px',
                                                    borderLeft: '3px solid transparent',
                                                    ...(activeId === sub.id && {
                                                        backgroundColor: Palette.background.paleBlue,
                                                        borderLeftColor: Palette.primary.main,
                                                        color: Palette.primary.main,
                                                        fontWeight: 700,
                                                    }),
                                                }}
                                            >
                                                {sub.label}
                                            </Link>
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
};

export default CommentsSidebarToc;

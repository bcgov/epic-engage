import { useState } from 'react';
import { Box, Link, Typography } from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { CommentSection } from './buildCommentSections';
import { Palette } from 'styles/Theme';

interface CommentsSidebarTocProps {
    sections: CommentSection[];
    activeId: string | null;
    onNavigate: (id: string) => void;
}

export const CommentsSidebarToc = ({ sections, activeId, onNavigate }: CommentsSidebarTocProps) => {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <Box
            component="aside"
            sx={{ width: 260, flexShrink: 0, position: 'sticky', top: 20, mr: '28px' }}
        >
            <Box
                component="button"
                onClick={() => setCollapsed((prev) => !prev)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    backgroundColor: Palette.primary.main,
                    color: Palette.background.default,
                    border: 'none',
                    borderRadius: collapsed ? '6px' : '6px 6px 0 0',
                    padding: '10px 14px',
                    fontFamily: 'inherit',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                }}
            >
                <span>List of comments</span>
                {collapsed ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
            </Box>
            {!collapsed && (
                <Box
                    sx={{
                        backgroundColor: Palette.background.offWhite,
                        border: `1px solid ${Palette.border.default}`,
                        borderTop: 'none',
                        borderRadius: '0 0 6px 6px',
                        padding: '8px 0 12px',
                        maxHeight: '70vh',
                        overflowY: 'auto',
                    }}
                >
                    {sections.map((section, index) => (
                        <Box key={section.id} sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Link
                                component="button"
                                type="button"
                                onClick={() => onNavigate(section.id)}
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
                                    ...(activeId === section.id && {
                                        backgroundColor: Palette.background.paleBlue,
                                        borderLeftColor: Palette.primary.main,
                                        fontWeight: 700,
                                    }),
                                }}
                            >
                                <Typography
                                    component="span"
                                    sx={{ fontSize: '11px', fontWeight: 700, color: Palette.text.disabled, minWidth: '16px' }}
                                >
                                    {index + 1}
                                </Typography>
                                <Typography component="span" sx={{ fontSize: '12px' }}>
                                    {section.title}
                                </Typography>
                            </Link>
                            {section.subSections && (
                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        pl: '14px',
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
                                            onClick={() => onNavigate(sub.id)}
                                            underline="none"
                                            sx={{
                                                fontSize: '12px',
                                                textAlign: 'left',
                                                padding: '3px 6px',
                                                borderRadius: '3px',
                                                borderLeft: '2px solid transparent',
                                                ...(activeId === sub.id && {
                                                    fontWeight: 700,
                                                    borderLeftColor: Palette.primary.main,
                                                }),
                                            }}
                                        >
                                            {sub.label}
                                        </Link>
                                    ))}
                                </Box>
                            )}
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default CommentsSidebarToc;

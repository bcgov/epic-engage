import { useState } from 'react';
import { Box, Link, Typography } from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { CommentSection } from './buildCommentSections';

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
                    backgroundColor: '#013366',
                    color: '#fff',
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
                        backgroundColor: '#F7F8FA',
                        border: '1px solid #d8d8d8',
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
                                        backgroundColor: '#E3EEF9',
                                        borderLeftColor: '#013366',
                                        fontWeight: 700,
                                    }),
                                }}
                            >
                                <Typography
                                    component="span"
                                    sx={{ fontSize: '11px', fontWeight: 700, color: '#9F9D9C', minWidth: '16px' }}
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
                                        borderLeft: '2px solid #d8d8d8',
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
                                                    borderLeftColor: '#013366',
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

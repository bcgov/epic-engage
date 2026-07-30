import { useLayoutEffect, useRef, useState } from 'react';
import { Box, Link } from '@mui/material';
import { MetDescription } from 'components/shared/common';
import { Palette } from 'styles/Theme';

interface CommentItemProps {
    text: string;
}

const CLAMPED_LINES = 3;

export const CommentItem = ({ text }: CommentItemProps) => {
    const [expanded, setExpanded] = useState(false);
    const [canClamp, setCanClamp] = useState(false);
    const textRef = useRef<HTMLParagraphElement | null>(null);

    useLayoutEffect(() => {
        const el = textRef.current;
        if (el) {
            setCanClamp(el.scrollHeight > el.clientHeight);
        }
    }, [text]);

    return (
        <Box
            sx={{
                p: '14px 16px',
                borderRadius: '0 6px 6px 0',
                border: `1px solid ${Palette.border.default}`,
                borderLeft: `3px solid ${Palette.primary.main}`,
                backgroundColor: Palette.background.offWhite,
            }}
        >
            <MetDescription
                ref={textRef}
                sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: Palette.text.secondary,
                    lineHeight: 1.6,
                    ...(expanded
                        ? {}
                        : {
                              display: '-webkit-box',
                              WebkitLineClamp: CLAMPED_LINES,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                          }),
                }}
            >
                {text}
            </MetDescription>
            {canClamp && (
                <Link
                    component="button"
                    type="button"
                    onClick={() => setExpanded((prev) => !prev)}
                    sx={{
                        display: 'inline-block',
                        mt: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                    }}
                >
                    {expanded ? 'Show less' : 'Show more'}
                </Link>
            )}
        </Box>
    );
};

export default CommentItem;

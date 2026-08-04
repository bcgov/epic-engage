import { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { Palette } from 'styles/Theme';

interface ConditionalBlockProps {
    // The question this block was shown to respondents for.
    question: string;
    // The answer to the parent question that revealed it, when the survey records one.
    eq?: string;
    children: ReactNode;
}

/**
 * A question that formio only showed to respondents who answered the question above it a
 * certain way. It shares a card with that question, separated by a dashed line.
 */
export const ConditionalBlock = ({ question, eq, children }: ConditionalBlockProps) => (
    <Box sx={{ mt: 2, pt: 2, borderTop: '2px dashed #D8D8D8' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: '#72B09D' }} />
            <Typography
                sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: '#474543',
                }}
            >
                {eq ? `Conditional — shown to respondents who answered "${eq}"` : 'Conditional question'}
            </Typography>
        </Box>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: Palette.text.primary, mb: 1.25 }}>
            {question}
        </Typography>
        {children}
    </Box>
);

export default ConditionalBlock;

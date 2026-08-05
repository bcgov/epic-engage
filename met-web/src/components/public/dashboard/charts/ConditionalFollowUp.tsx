import { useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import { MetIconText, PrimaryButton } from 'components/shared/common';
import { CommentsDrawer } from './CommentsDrawer';
import { Palette } from 'styles/Theme';

interface ConditionalFollowUpProps {
    // e.g. `Conditional — shown to respondents who selected "Other"`
    conditionLabel: string;
    // The follow-up question's own label/prompt, e.g. "Please tell us more about your
    // connection to the project area." - shown inline and used as the comments drawer title.
    question: string;
    responses: string[];
}

export const ConditionalFollowUp = ({ conditionLabel, question, responses }: ConditionalFollowUpProps) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    return (
        <Box sx={{ mt: 2, pt: 2, borderTop: `2px dashed ${Palette.border.default}` }}>
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: Palette.chart.conditionalMarker, flexShrink: 0 }} />
                <MetIconText
                    sx={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: Palette.text.secondary,
                    }}
                >
                    {conditionLabel}
                </MetIconText>
            </Stack>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: Palette.text.primary, mb: '10px' }}>{question}</Typography>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    backgroundColor: Palette.chart.surface.rowHover,
                    border: `1px solid ${Palette.border.default}`,
                    borderRadius: '6px',
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <Box sx={{ fontSize: '28px', fontWeight: 700, color: Palette.primary.main, lineHeight: 1 }}>
                        {responses.length}
                    </Box>
                    <MetIconText
                        sx={{
                            fontSize: '12px',
                            color: Palette.text.secondary,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                        }}
                    >
                        comments received
                    </MetIconText>
                </Box>
                <PrimaryButton
                    startIcon={<QuestionAnswerIcon />}
                    onClick={() => setIsDrawerOpen(true)}
                    sx={{ ml: 'auto' }}
                >
                    Read comments
                </PrimaryButton>
            </Box>
            <CommentsDrawer
                open={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                question={question}
                responses={responses}
            />
        </Box>
    );
};

export default ConditionalFollowUp;

import { useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import { MetIconText, PrimaryButton } from 'components/shared/common';
import { CommentsDrawer } from './CommentsDrawer';

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
        <Box sx={{ mt: 2, pt: 2, borderTop: '2px dashed #D8D8D8' }}>
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#72B09D', flexShrink: 0 }} />
                <MetIconText
                    sx={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: '#474543',
                    }}
                >
                    {conditionLabel}
                </MetIconText>
            </Stack>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#2D2D2D', mb: '10px' }}>{question}</Typography>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    backgroundColor: '#F7F8FA',
                    border: '1px solid #D8D8D8',
                    borderRadius: '6px',
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <Box sx={{ fontSize: '28px', fontWeight: 700, color: '#013366', lineHeight: 1 }}>
                        {responses.length}
                    </Box>
                    <MetIconText
                        sx={{
                            fontSize: '12px',
                            color: '#474543',
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

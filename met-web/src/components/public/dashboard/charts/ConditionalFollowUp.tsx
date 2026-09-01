import { useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import { MetIconText, PrimaryButton } from 'components/shared/common';
import { CommentsDrawer } from './CommentsDrawer';
import { QuestionDescription } from './QuestionDescription';
import { Palette } from 'styles/Theme';

export interface FollowUpSection {
    // The Likert row / Ranking statement this follow-up hangs off - the only thing telling
    // merged follow-ups apart, since they all share one condition.
    rowLabel?: string;
    // The follow-up question's own label/prompt, e.g. "Please tell us more about your
    // connection to the project area."
    question: string;
    // Staff's description of the follow-up question, shown under it.
    description?: string;
    responses: string[];
}

interface ConditionalFollowUpProps {
    // e.g. `Conditional — shown to respondents who selected "Other"`
    conditionLabel: string;
    sections: FollowUpSection[];
    // The trigger question's label when the block merges several follow-ups, since none of
    // their own questions covers the rest.
    drawerTitle: string;
    // e.g. `comments received`, or `comments across all rows` for a merged block.
    countLabel: string;
}

export const ConditionalFollowUp = ({
    conditionLabel,
    sections,
    drawerTitle,
    countLabel,
}: ConditionalFollowUpProps) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const isMerged = sections.length > 1;
    const totalResponses = sections.reduce((total, section) => total + section.responses.length, 0);

    return (
        <Box sx={{ mt: 2, pt: 2, borderTop: `2px dashed ${Palette.border.default}` }}>
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1.5 }}>
                <Box
                    sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: Palette.chart.conditionalMarker,
                        flexShrink: 0,
                    }}
                />
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
            {/* A merged block has a different question per row - those are listed in the drawer,
            and so are the descriptions that go with them. */}
            {!isMerged && (
                <Box sx={{ mb: '10px' }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: Palette.text.primary }}>
                        {sections[0].question}
                    </Typography>
                    <QuestionDescription description={sections[0].description} />
                </Box>
            )}
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
                        {totalResponses.toLocaleString()}
                    </Box>
                    <MetIconText
                        sx={{
                            fontSize: '12px',
                            color: Palette.text.secondary,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                        }}
                    >
                        {countLabel}
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
                question={drawerTitle}
                responses={isMerged ? [] : sections[0].responses}
                sections={isMerged ? sections : undefined}
            />
        </Box>
    );
};

export default ConditionalFollowUp;

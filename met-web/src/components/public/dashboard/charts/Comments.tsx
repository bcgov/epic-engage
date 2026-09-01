import { useState } from 'react';
import { Box } from '@mui/material';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import { MetPaper, MetHeader4, MetIconText, PrimaryButton } from 'components/shared/common';
import { QuestionTypeLabel } from './QuestionTypeLabel';
import { QuestionDescription } from './QuestionDescription';
import { CommentsDrawer } from './CommentsDrawer';
import { Palette } from 'styles/Theme';

interface CommentsProps {
    question: string;
    responses: string[];
    questionType?: string;
    // Staff's description of the question, shown under it. Only rendered with the card - a
    // `bare` caller renders its own.
    description?: string;
    // Renders just the comment-count box and drawer trigger, without the surrounding MetPaper
    // card/title, for callers that render their own.
    bare?: boolean;
}

export const Comments = ({ question, responses, questionType, description, bare = false }: CommentsProps) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const countBox = (
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
            <PrimaryButton startIcon={<QuestionAnswerIcon />} onClick={() => setIsDrawerOpen(true)} sx={{ ml: 'auto' }}>
                Read comments
            </PrimaryButton>
        </Box>
    );

    return (
        <>
            {bare ? (
                countBox
            ) : (
                <MetPaper sx={{ p: 3, border: `1px solid ${Palette.border.default}` }}>
                    {questionType && <QuestionTypeLabel label={questionType} />}
                    <MetHeader4 sx={{ lineHeight: 1.4, mb: '12px' }}>{question}</MetHeader4>
                    <QuestionDescription description={description} />
                    <MetIconText sx={{ fontSize: '12px', color: Palette.text.secondary, mb: '18px' }}>
                        {responses.length} comments
                    </MetIconText>
                    {countBox}
                </MetPaper>
            )}
            <CommentsDrawer
                open={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                question={question}
                responses={responses}
                questionType={questionType}
            />
        </>
    );
};

export default Comments;

import { useState } from 'react';
import { Box } from '@mui/material';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import { MetPaper, MetHeader4, MetIconText, PrimaryButton } from 'components/shared/common';
import { QuestionTypeLabel } from './QuestionTypeLabel';
import { CommentsDrawer } from './CommentsDrawer';

interface CommentsProps {
    question: string;
    responses: string[];
    questionType?: string;
}

export const Comments = ({ question, responses, questionType }: CommentsProps) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    return (
        <>
            <MetPaper sx={{ p: 3, border: '1px solid #d8d8d8' }}>
                {questionType && <QuestionTypeLabel label={questionType} />}
                <MetHeader4 sx={{ lineHeight: 1.4, mb: '12px' }}>{question}</MetHeader4>
                <MetIconText sx={{ fontSize: '12px', color: '#474543', mb: '18px' }}>
                    {responses.length} comments
                </MetIconText>
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
            </MetPaper>
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

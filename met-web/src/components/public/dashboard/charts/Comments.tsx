import { useState } from 'react';
import { Box, Drawer, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import { MetPaper, MetHeader4, MetDescription, MetIconText, PrimaryButton } from 'components/shared/common';
import { QuestionTypeLabel } from './QuestionTypeLabel';

const DRAWER_HEIGHT = '95vh';

interface CommentsProps {
    question: string;
    responses: string[];
    questionType?: string;
}

const renderResponses = (responses: string[]) =>
    responses.map((response, responseIndex) => (
        <Box
            key={`response-${responseIndex}`}
            sx={{
                p: '10px 14px',
                borderRadius: '0 6px 6px 0',
                border: '1px solid #D8D8D8',
                borderLeft: '3px solid #013366',
                backgroundColor: '#ffffff',
                mb: 1,
            }}
        >
            <MetDescription
                sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#454743',
                    lineHeight: 1.5,
                }}
            >
                {response}
            </MetDescription>
        </Box>
    ));

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
            <Drawer
                anchor="bottom"
                open={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                PaperProps={{
                    sx: {
                        height: DRAWER_HEIGHT,
                        borderTopLeftRadius: '12px',
                        borderTopRightRadius: '12px',
                    },
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        p: '20px 24px 12px 24px',
                        borderBottom: '1px solid #d8d8d8',
                    }}
                >
                    <Box>
                        {questionType && <QuestionTypeLabel label={questionType} />}
                        <MetHeader4 sx={{ lineHeight: 1.4 }}>{question}</MetHeader4>
                        <MetDescription sx={{ color: '#9F9D9C' }}>{responses.length} comments</MetDescription>
                    </Box>
                    <IconButton aria-label="Close comments" onClick={() => setIsDrawerOpen(false)}>
                        <CloseIcon />
                    </IconButton>
                </Box>
                <Box sx={{ flex: 1, overflowY: 'auto', p: '16px 24px', backgroundColor: '#F2F2F2' }}>
                    {renderResponses(responses)}
                </Box>
            </Drawer>
        </>
    );
};

export default Comments;

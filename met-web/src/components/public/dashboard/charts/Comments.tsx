import { Box } from '@mui/material';
import { MetPaper, MetHeader2, MetDescription, MetIconText } from 'components/shared/common';

const SCROLL_HEIGHT = 310;

interface CommentsProps {
    question: string;
    subText: string;
    responses: string[];
}

const renderResponses = (responses: string[]) =>
    responses.map((response, responseIndex) => (
        <Box
            key={`response-${responseIndex}`}
            sx={{
                p: '10px 14px',
                borderRadius: '6px',
                border: '1px solid #cfcfcf',
                backgroundColor: '#ffffff',
                mb: 1,
                '&:hover': {
                    borderLeft: '3px solid #013366',
                },
                borderLeft: '3px solid #D8D8D8',
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

export const Comments = ({ question, subText, responses }: CommentsProps) => {
    return (
        <MetPaper sx={{ p: 3, border: '1px solid #d8d8d8' }}>
            <MetHeader2 sx={{ lineHeight: 1.4 }}>{question}</MetHeader2>
            <MetDescription sx={{mb: "18px" }}>Open text • {responses.length} respondents provided comments</MetDescription>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
                <Box sx={{ width: 10, height: 10, backgroundColor: '#11467a', borderRadius: '2px' }} />
                <MetDescription sx={{ color: '#11467a', fontWeight: 'bold' }}>{subText}</MetDescription>
            </Box>

            <Box
                sx={{
                    border: '1px solid #cfcfcf',
                    borderRadius: '6px',
                    backgroundColor: '#F2F2F2',
                    p: 1,
                }}
            >
                <Box
                    sx={{
                        maxHeight: SCROLL_HEIGHT,
                        overflowY: 'auto',
                        pr: 0.5,
                    }}
                >
                    {renderResponses(responses)}
                </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, px: 0.25 }}>
                <MetIconText sx={{ color: '#9F9D9C' }}>{responses.length} comments</MetIconText>
                <MetIconText sx={{ color: '#9F9D9C' }}>Scroll to view all</MetIconText>
            </Box>
        </MetPaper>
    );
};

export default Comments;

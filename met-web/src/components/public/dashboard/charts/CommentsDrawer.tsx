import { Box, Drawer, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { MetHeader4, MetDescription } from 'components/shared/common';
import { QuestionTypeLabel } from './QuestionTypeLabel';

const DRAWER_HEIGHT = '100vh';

interface CommentsDrawerProps {
    open: boolean;
    onClose: () => void;
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

export const CommentsDrawer = ({ open, onClose, question, responses, questionType }: CommentsDrawerProps) => (
    <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        // The logged-in InternalHeader is a fixed AppBar at theme.zIndex.drawer + 1; go
        // above it so this drawer covers the full screen, header included, while open.
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 2 }}
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
            <IconButton aria-label="Close comments" onClick={onClose}>
                <CloseIcon />
            </IconButton>
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto', p: '16px 24px', backgroundColor: '#F2F2F2' }}>
            {renderResponses(responses)}
        </Box>
    </Drawer>
);

export default CommentsDrawer;

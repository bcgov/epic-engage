import { Box, Drawer, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { MetHeader4, MetDescription } from 'components/shared/common';
import { QuestionTypeLabel } from './QuestionTypeLabel';
import { Palette } from 'styles/Theme';

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
                border: `1px solid ${Palette.border.default}`,
                borderLeft: `3px solid ${Palette.primary.main}`,
                backgroundColor: Palette.background.default,
                mb: 1,
            }}
        >
            <MetDescription
                sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: Palette.text.secondary,
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
                borderBottom: `1px solid ${Palette.border.default}`,
            }}
        >
            <Box>
                {questionType && <QuestionTypeLabel label={questionType} />}
                <MetHeader4 sx={{ lineHeight: 1.4 }}>{question}</MetHeader4>
                <MetDescription sx={{ color: Palette.text.disabled }}>{responses.length} comments</MetDescription>
            </Box>
            <IconButton aria-label="Close comments" onClick={onClose}>
                <CloseIcon />
            </IconButton>
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto', p: '16px 24px', backgroundColor: Palette.chart.surface.drawer }}>
            {renderResponses(responses)}
        </Box>
    </Drawer>
);

export default CommentsDrawer;

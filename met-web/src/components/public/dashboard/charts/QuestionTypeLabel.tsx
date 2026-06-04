import { Box } from '@mui/material';
import { Palette } from 'styles/Theme';

interface QuestionTypeLabelProps {
    label: string;
}

export const QuestionTypeLabel = ({ label }: QuestionTypeLabelProps) => (
    <Box
        component="span"
        sx={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: Palette.primary.main,
            background: '#E3EEF9',
            borderRadius: '20px',
            px: 1.25,
            py: '3px',
            mb: 1.25,
        }}
    >
        {label}
    </Box>
);

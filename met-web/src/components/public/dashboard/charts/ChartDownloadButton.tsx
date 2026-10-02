import { Box } from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { Palette } from 'styles/Theme';

// Sits in the top-right corner of a chart card, so the card must be `position: relative`.
export const ChartDownloadButton = ({ onClick }: { onClick: () => void }) => (
    <Box
        component="button"
        type="button"
        onClick={onClick}
        aria-label="Download chart as PNG"
        title="Download chart as PNG"
        sx={{
            position: 'absolute',
            top: 14,
            right: 14,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            px: 1,
            py: '5px',
            background: Palette.background.default,
            border: `1px solid ${Palette.border.default}`,
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 11,
            fontWeight: 600,
            color: Palette.primary.main,
            transition: 'border-color .15s',
            '&:hover': { borderColor: Palette.primary.main, background: Palette.chart.surface.callout },
        }}
    >
        <FileDownloadOutlinedIcon sx={{ fontSize: 14 }} />
        PNG
    </Box>
);

import { Box, Typography } from '@mui/material';
import { MetPaper, MetHeader4, MetDescription } from 'components/shared/common';
import { Palette } from 'styles/Theme';
import { QuestionTypeLabel } from './QuestionTypeLabel';

export interface CheckboxChartItem {
    label: string;
    pct: number;
    count: number;
}

interface CheckboxChartProps {
    question: string;
    // Omitted when the backend has no participant-backed count to report; the summary line then
    // drops the number rather than showing one that undercounts.
    respondentCount?: number;
    data: CheckboxChartItem[];
    questionType?: string;
    // Renders just the chart content, without the surrounding MetPaper card/title, for callers
    // that render their own.
    bare?: boolean;
}

const HEADER_SX = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: Palette.text.secondary,
};

export const CheckboxChart = ({ question, respondentCount, data, questionType, bare = false }: CheckboxChartProps) => {
    const content = (
        <>
            <MetDescription sx={{ mb: '18px' }}>
                Multiple selections allowed
                {respondentCount ? ` · ${respondentCount.toLocaleString()} respondents` : ''}
            </MetDescription>
            <Box
                sx={{
                    fontSize: 13,
                    color: Palette.primary.main,
                    background: Palette.chart.surface.callout,
                    borderLeft: `4px solid ${Palette.primary.main}`,
                    borderRadius: '4px',
                    px: 1.5,
                    py: 1,
                    mb: 1.5,
                }}
            >
                Respondents could select multiple options. Percentages show the share who selected each option.
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 0.5,
                    pb: 0.75,
                    borderBottom: `1px solid ${Palette.border.default}`,
                    mb: 0.5,
                }}
            >
                <Typography sx={{ ...HEADER_SX, flex: 1 }}>Response</Typography>
                <Typography sx={{ ...HEADER_SX, width: 64, textAlign: 'right' }}>% of Respondents</Typography>
                <Typography sx={{ ...HEADER_SX, width: 64, textAlign: 'right' }}>Count</Typography>
            </Box>

            {data.map((item, i) => (
                <Box
                    key={item.label}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 0.5,
                        py: 0.75,
                        borderBottom: i < data.length - 1 ? `1px solid ${Palette.chart.surface.rowDivider}` : 'none',
                        '&:hover': { background: Palette.chart.surface.rowHover, borderRadius: '4px' },
                    }}
                >
                    <Typography sx={{ flex: 1, fontSize: 13, color: Palette.text.primary }}>{item.label}</Typography>
                    <Typography
                        sx={{
                            width: 64,
                            fontSize: 13,
                            fontWeight: 700,
                            color: Palette.primary.main,
                            textAlign: 'right',
                        }}
                    >
                        {item.pct}%
                    </Typography>
                    <Typography sx={{ width: 64, fontSize: 12, color: Palette.text.secondary, textAlign: 'right' }}>
                        {item.count.toLocaleString()}
                    </Typography>
                </Box>
            ))}
        </>
    );

    if (bare) {
        return content;
    }

    return (
        <MetPaper sx={{ p: 3, border: `1px solid ${Palette.border.default}` }}>
            {questionType && <QuestionTypeLabel label={questionType} />}
            <MetHeader4 sx={{ lineHeight: 1.4 }}>{question}</MetHeader4>
            {content}
        </MetPaper>
    );
};

export default CheckboxChart;

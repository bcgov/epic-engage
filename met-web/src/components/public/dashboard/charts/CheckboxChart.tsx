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
    respondentCount: number;
    data: CheckboxChartItem[];
    questionType?: string;
}

export const CheckboxChart = ({ question, respondentCount, data, questionType }: CheckboxChartProps) => {
    const sorted = [...data].sort((a, b) => b.pct - a.pct);

    return (
        <MetPaper sx={{ p: 3, border: '1px solid #d8d8d8' }}>
            {questionType && <QuestionTypeLabel label={questionType} />}
            <MetHeader4 sx={{ lineHeight: 1.4 }}>{question}</MetHeader4>
            <MetDescription sx={{ mb: '18px' }}>
                Multiple selections allowed · {respondentCount.toLocaleString()} respondents
            </MetDescription>

            <Box
                sx={{
                    fontSize: 13,
                    color: Palette.primary.main,
                    background: '#E3EEF9',
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
                    justifyContent: 'flex-end',
                    columnGap: 1,
                    pb: 0.75,
                    borderBottom: '1px solid #D8D8D8',
                    mb: 0.5,
                }}
            >
                <Typography
                    sx={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: '#474543',
                        width: 64,
                        textAlign: 'right',
                    }}
                >
                    % of Respondents
                </Typography>
                <Typography
                    sx={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: '#474543',
                        width: 64,
                        textAlign: 'right',
                    }}
                >
                    Count
                </Typography>
            </Box>

            {sorted.map((item, i) => (
                <Box
                    key={item.label}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 0.5,
                        py: 0.75,
                        borderBottom: i < sorted.length - 1 ? '1px solid #F0EFEE' : 'none',
                        '&:hover': { background: '#F7F8FA', borderRadius: '4px' },
                    }}
                >
                    <Typography sx={{ flex: 1, fontSize: 13, color: Palette.text.primary }}>
                        {item.label}
                    </Typography>
                    <Typography
                        sx={{ width: 64, fontSize: 13, fontWeight: 700, color: Palette.primary.main, textAlign: 'right' }}
                    >
                        {item.pct}%
                    </Typography>
                    <Typography sx={{ width: 64, fontSize: 12, color: '#474543', textAlign: 'right' }}>
                        {item.count.toLocaleString()}
                    </Typography>
                </Box>
            ))}
        </MetPaper>
    );
};

export default CheckboxChart;

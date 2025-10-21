import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { SurveyBarData } from 'components/public/dashboard/types';
import { DASHBOARD } from '../../constants';
import { Box } from '@mui/material';
import TooltipContent from './TooltipContent';

interface BarBlockProps {
    data: SurveyBarData;
}
export const SurveyBarBlock = ({ data }: BarBlockProps) => {
    const minHeight = 400;
    const maxHeight = 1300;

    const numberOfCategories = data.result.length;
    const height = Math.min(Math.max(numberOfCategories * 40, minHeight), maxHeight);

    return (
        <Box marginLeft={{ xs: 0, sm: '2em' }} marginTop={'3em'}>
            <ResponsiveContainer width={'100%'} height={height} key={data.position}>
                <BarChart data={data.result} layout={'vertical'} key={data.position} margin={{ left: 0 }}>
                    <XAxis
                        dataKey={undefined}
                        type={'number'}
                        axisLine={true}
                        tickLine={true}
                        minTickGap={10}
                        tickMargin={10}
                        hide={true}
                    />
                    <YAxis
                        width={250}
                        dataKey={'value'}
                        type={'category'}
                        axisLine={true}
                        tickLine={true}
                        minTickGap={10}
                        tickMargin={10}
                        hide={false}
                        tickFormatter={(value: string) =>
                            value.length > 25 ? value.slice(0, 25).trimEnd().concat('...') : value
                        }
                    />
                    <Tooltip content={<TooltipContent />} />
                    <Bar
                        dataKey="count"
                        stackId="a"
                        fill={DASHBOARD.BAR_CHART.FILL_COLOR}
                        minPointSize={2}
                        barSize={32}
                    >
                        <LabelList dataKey="count" position={'insideRight'} style={{ fill: 'white' }} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </Box>
    );
};

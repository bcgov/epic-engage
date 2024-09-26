import React, { useEffect, useState } from 'react';
import { Box, Grid, Skeleton, Divider } from '@mui/material';
import { MetHeader1, MetPaper, MetLabel } from 'components/common';
import { SurveyBarData } from '../types';
import { getSurveyResultData } from 'services/analytics/surveyResult';
import { Engagement } from 'models/engagement';
import { SurveyResultData, createSurveyResultData } from '../../../models/analytics/surveyResult';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { DASHBOARD } from '../constants';

const minHeight = 400;
const maxHeight = 1300;

interface SurveyQuestionProps {
    engagement: Engagement;
    engagementIsLoading: boolean;
    dashboardType: string;
}

export const SurveyBarPrintable = ({ engagement, engagementIsLoading, dashboardType }: SurveyQuestionProps) => {
    const [data, setData] = useState<SurveyResultData>(createSurveyResultData());
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const response = await getSurveyResultData(Number(engagement.id), dashboardType);
            response.data[0].result = response.data[0].result.map((answer) => {
                const value =
                    answer.value.length > 25 ? answer.value.slice(0, 25).trimEnd().concat('...') : answer.value;
                const count = answer.count;
                return { count, value };
            });
            setData(response);
            setIsLoading(false);
            setIsError(false);
        } catch (error) {
            setIsError(true);
        }
    };

    useEffect(() => {
        if (Number(engagement.id)) {
            fetchData();
        }
    }, [engagement.id]);

    if (isLoading || engagementIsLoading) {
        return <Skeleton variant="rectangular" width={'100%'} height={minHeight} />;
    }

    if (isError) {
        return (
            <>
                <Grid item xs={12}>
                    <MetLabel mb={2} color="primary">
                        Survey Results
                    </MetLabel>
                </Grid>
            </>
        );
    }

    return (
        <>
            <Grid item xs={12} mb={2}>
                <MetHeader1>Survey Results</MetHeader1>
            </Grid>
            {Object.values(data).map((value) => {
                return value.map((result: SurveyBarData, i: number) => {
                    const numberOfCategories = result.result.length;
                    const labelMargin = 20; // Margin between label and axis
                    // Calculate the maximum length of values in the category
                    const maxLabelLength = result.result.reduce((max, category) => {
                        const labelLength = category.value.length;
                        return labelLength > max ? labelLength : max;
                    }, 0);
                    // Divide the text into lines of 35 characters
                    const linesPerLabel = Math.ceil(maxLabelLength / 35) * 5; // 5 is a Buffer
                    // Calculate the height based on the number of categories and the space required for labels
                    const height = Math.min(
                        Math.max(numberOfCategories * (linesPerLabel + labelMargin), minHeight),
                        maxHeight,
                    );
                    return (
                        <div id={'question' + i} key={i}>
                            <Grid key={result.position} mb={2} item xs={12}>
                                <MetPaper sx={{ p: 2 }}>
                                    <Grid item xs={12}>
                                        <MetLabel mb={2} color="primary">
                                            {result.label}
                                        </MetLabel>
                                        <Divider sx={{ marginTop: '1em' }} />
                                        <Box marginLeft={{ xs: 0, sm: '2em' }} marginTop={'3em'}>
                                            <ResponsiveContainer width={'100%'} height={height} key={result.position}>
                                                <BarChart
                                                    data={result.result}
                                                    layout={'vertical'}
                                                    key={result.position}
                                                    margin={{ left: 0 }}
                                                >
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
                                                            value.length > 25 ? value.slice(0, 25) + '...' : value
                                                        }
                                                    />
                                                    <Tooltip />
                                                    <Bar
                                                        dataKey="count"
                                                        stackId="a"
                                                        fill={DASHBOARD.BAR_CHART.FILL_COLOR}
                                                        minPointSize={2}
                                                        barSize={32}
                                                    >
                                                        <LabelList
                                                            dataKey="count"
                                                            position={'insideRight'}
                                                            style={{ fill: 'white' }}
                                                        />
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </Box>
                                    </Grid>
                                </MetPaper>
                            </Grid>
                        </div>
                    );
                });
            })}
        </>
    );
};

export default SurveyBarPrintable;

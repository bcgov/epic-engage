import { Box, Stack, Tooltip, Typography } from '@mui/material';

export interface LiveActivityDatum {
    label: string;
    count: number;
}

interface LiveActivityChartProps {
    data: LiveActivityDatum[];
}

const BAR_HEIGHT = 48;

export const LiveActivityChart = ({ data }: LiveActivityChartProps) => {
    const max = Math.max(1, ...data.map((d) => d.count));

    return (
        <Box sx={{ maxWidth: 380 }}>
            <Typography
                sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#898785',
                    mb: 1,
                }}
            >
                Responses over time
            </Typography>
            <Stack direction="row" alignItems="flex-end" spacing={0.5} sx={{ height: BAR_HEIGHT }}>
                {data.map((d, index) => (
                    <Tooltip key={`${d.label}-${index}`} title={`${d.label}: ${d.count}`} arrow>
                        <Box
                            sx={{
                                flex: 1,
                                height: `${Math.max(2, Math.round((d.count / max) * BAR_HEIGHT))}px`,
                                backgroundColor: '#D8EAFD',
                                borderRadius: '2px 2px 0 0',
                                transition: 'background-color .15s',
                                cursor: 'default',
                                '&:hover': { backgroundColor: '#013366' },
                            }}
                        />
                    </Tooltip>
                ))}
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                {data.map((d, index) => (
                    <Typography
                        key={`${d.label}-${index}`}
                        sx={{
                            flex: 1,
                            fontSize: 9,
                            color: '#898785',
                            textAlign: 'center',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {d.label}
                    </Typography>
                ))}
            </Stack>
        </Box>
    );
};

export default LiveActivityChart;

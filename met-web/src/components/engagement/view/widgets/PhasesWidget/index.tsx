import React, { useContext, useState } from 'react';
import { Grid, Skeleton, Stack } from '@mui/material';
import { MetBody, MetHeader3, MetPaper } from 'components/common';
import { WidgetType } from 'models/widget';
import { ActionContext } from '../../ActionContext';
import { EngagementPhase } from './EngagementPhase';
import { ENGAGEMENT_PHASES } from 'models/engagementPhases';

interface PhaseContextProps {
    anchorEl: HTMLButtonElement | null;
    setAnchorEl: React.Dispatch<React.SetStateAction<HTMLButtonElement | null>>;
}

export const PhaseContext = React.createContext<PhaseContextProps>({
    anchorEl: null,
    setAnchorEl: () => {
        throw new Error('Not implemented');
    },
});
export const PhasesWidget = () => {
    const { widgets, isWidgetsLoading } = useContext(ActionContext);
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const phases = Object.values(ENGAGEMENT_PHASES);
    const phasesWidget = widgets.find((widget) => widget.widget_type_id === WidgetType.Phases);

    if (isWidgetsLoading) {
        return <Skeleton variant="rectangular" height={'20em'} />;
    }

    if (!phasesWidget) {
        return null;
    }

    return (
        <PhaseContext.Provider
            value={{
                anchorEl,
                setAnchorEl,
            }}
        >
            <MetPaper elevation={1} sx={{ padding: '2em' }}>
                <Grid container direction="row" justifyContent="flex-start" alignItems="flex-start" rowSpacing={2}>
                    <Grid item xs={12}>
                        <MetHeader3 bold>The EA Process</MetHeader3>
                    </Grid>
                    <Grid item xs={12}>
                        <MetBody>
                            Click on the sections below to expand them and learn more about each EA process phase. You
                            can also learn more about each engagement period by clicking the engagement icon.
                        </MetBody>
                    </Grid>
                    <Grid item xs={12} sx={{ maxWidth: '99%' }}>
                        <Stack direction="row" sx={{ overflowX: 'auto', overflowY: 'clip' }}>
                            {phases.map((phase) => (
                                <EngagementPhase key={phase.title} {...phase} />
                            ))}
                        </Stack>
                    </Grid>
                </Grid>
            </MetPaper>
        </PhaseContext.Provider>
    );
};
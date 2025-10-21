import React from 'react';
import { EngagementViewProvider } from './EngagementViewContext';
import EngagementView from './EngagementView';

export const Engagement = () => {
    return (
        <EngagementViewProvider>
            <EngagementView />
        </EngagementViewProvider>
    );
};

export default Engagement;

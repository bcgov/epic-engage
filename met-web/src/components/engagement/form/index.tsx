import React from 'react';
import { EngagementFormProvider } from './EngagementFormContext';
import EngagementFormWrapper from './EngagementFormWrapper';

const Engagement = () => {
    return (
        <EngagementFormProvider>
            <EngagementFormWrapper />
        </EngagementFormProvider>
    );
};

export default Engagement;

import React from 'react';
import SubmitSurveyWrapper from './SubmitSurveyWrapper';
import { SubmitSurveyProvider } from './SubmitSurveyContext';

const SubmitSurvey = () => {
    return (
        <SubmitSurveyProvider>
            <SubmitSurveyWrapper />
        </SubmitSurveyProvider>
    );
};

export default SubmitSurvey;

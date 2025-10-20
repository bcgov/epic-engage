import React from 'react';
import EditSurveyWrapped from './EditFormWrapper';
import { EditSurveyProvider } from './EditSurveyContext';

const EditSurvey = () => {
    return (
        <EditSurveyProvider>
            <EditSurveyWrapped />
        </EditSurveyProvider>
    );
};

export default EditSurvey;

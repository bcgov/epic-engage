import React from 'react';
import { FormSubmitterProps } from './types';
import SinglePageForm from './SinglePageForm';
import MultiPageForm from './MultiPageForm';

const FormSubmit = ({
    handleFormChange,
    savedForm,
    handleFormSubmit,
    surveyId,
    surveyName,
    engagementId,
    engagementName,
}: FormSubmitterProps) => {
    const isMultiPage = savedForm && savedForm.display === 'wizard';

    return isMultiPage ? (
        <MultiPageForm
            handleFormChange={handleFormChange}
            savedForm={savedForm}
            handleFormSubmit={handleFormSubmit}
            surveyId={surveyId}
            surveyName={surveyName}
            engagementId={engagementId}
            engagementName={engagementName}
        />
    ) : (
        <SinglePageForm handleFormChange={handleFormChange} savedForm={savedForm} handleFormSubmit={handleFormSubmit} />
    );
};

export default FormSubmit;

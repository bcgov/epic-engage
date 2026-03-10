import React from 'react';
import { FormSubmitterProps } from './types';
import SinglePageForm from './SinglePageForm';
import MultiPageForm from './MultiPageForm';

const FormSubmit = ({ handleFormChange, savedForm, handleFormSubmit, surveyId, engagementId }: FormSubmitterProps) => {
    const isMultiPage = savedForm && savedForm.display === 'wizard';

    return isMultiPage ? (
        <MultiPageForm
            handleFormChange={handleFormChange}
            savedForm={savedForm}
            handleFormSubmit={handleFormSubmit}
            surveyId={surveyId}
            engagementId={engagementId}
        />
    ) : (
        <SinglePageForm handleFormChange={handleFormChange} savedForm={savedForm} handleFormSubmit={handleFormSubmit} />
    );
};

export default FormSubmit;

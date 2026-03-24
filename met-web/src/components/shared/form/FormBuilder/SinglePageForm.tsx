import React from 'react';
import { Form } from '@formio/react';
import { FormSubmissionData, FormSubmitterProps } from './types';
import { analyticsService } from 'services/penguinAnalytics';

const SinglePageForm = ({
    handleFormChange,
    savedForm,
    handleFormSubmit,
    surveyId,
    surveyName,
    engagementId,
    engagementName,
}: FormSubmitterProps) => {
    const handleSurveyLinkClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!surveyId) return;
        const anchor = (event.target as HTMLElement).closest('a');
        if (!anchor?.href) return;
        analyticsService.track({
            action: 'link_click',
            widget_type: 'Survey',
            survey_id: surveyId,
            survey_name: surveyName,
            engagement_id: engagementId,
            engagement_name: engagementName,
            text: anchor.textContent?.trim() || anchor.href,
            url: anchor.href,
        });
    };

    return (
        <div className="formio" onClick={handleSurveyLinkClick}>
            <Form
                form={savedForm || { display: 'form' }}
                onChange={(form: unknown) => handleFormChange(form as FormSubmissionData)}
                onSubmit={(form: unknown) => {
                    const formSubmissionData = form as FormSubmissionData;
                    handleFormSubmit(formSubmissionData.data);
                }}
            />
        </div>
    );
};

export default SinglePageForm;

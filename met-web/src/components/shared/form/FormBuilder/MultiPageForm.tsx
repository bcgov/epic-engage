import React, { useState } from 'react';
import { Form } from '@formio/react';
import { FormSubmissionData, FormSubmitterProps } from './types';
import FormStepper from 'components/public/survey/submit/Stepper';
import { analyticsService } from 'services/penguinAnalytics';

interface PageData {
    page: number;
    submission: unknown;
}

const MultiPageForm = ({
    handleFormChange,
    savedForm,
    handleFormSubmit,
    surveyId,
    engagementId,
}: FormSubmitterProps) => {
    const [currentPage, setCurrentPage] = useState(0);
    const totalPages = savedForm?.components?.length || 0;

    const handleScrollUp = () => {
        window.scrollTo({
            top: 100,
            behavior: 'smooth',
        });
    };

    return (
        <div className="formio">
            <FormStepper currentPage={currentPage} pages={savedForm?.components ?? []} />
            <Form
                form={savedForm || { display: 'wizard' }}
                options={{ noAlerts: true }}
                onChange={(form: unknown) => handleFormChange(form as FormSubmissionData)}
                onNextPage={(pageData: PageData) => {
                    setCurrentPage(pageData.page);
                    handleScrollUp();
                    // Track step completion
                    if (surveyId) {
                        const pageName = savedForm?.components?.[pageData.page - 1]?.title || `Page ${pageData.page}`;
                        analyticsService.track({
                            action: 'completed_step',
                            survey_id: surveyId,
                            engagement_id: engagementId,
                            step_number: pageData.page,
                            step_count: totalPages,
                            step_name: pageName,
                        });
                    }
                }}
                onPrevPage={(pageData: PageData) => {
                    setCurrentPage(pageData.page);
                    handleScrollUp();
                }}
                onSubmit={(form: unknown) => {
                    const formSubmissionData = form as FormSubmissionData;
                    handleFormSubmit(formSubmissionData.data);
                }}
            />
        </div>
    );
};

export default MultiPageForm;

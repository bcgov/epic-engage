import React, { useState, useRef } from 'react';
import { Form } from '@formio/react';
import { FormSubmissionData, FormSubmitterProps } from './types';
import FormStepper from 'components/public/survey/submit/Stepper';
import { analyticsService } from 'services/penguinAnalytics';

interface PageData {
    page: number;
    submission: unknown;
}

interface FormioComponent {
    checkValidity: (data: unknown, dirty: boolean, rowData?: unknown) => boolean;
    type: string;
    key: string;
}

interface FormioInstance {
    data: Record<string, unknown>;
    everyComponent: (callback: (component: FormioComponent) => void) => void;
    showErrors: (errors?: unknown, triggerEvent?: boolean) => void;
    validateCurrentPage: () => boolean;
    nextPage: () => Promise<unknown>;
    submit: (...args: unknown[]) => Promise<unknown>;
}

const MultiPageForm = ({
    handleFormChange,
    savedForm,
    handleFormSubmit,
    surveyId,
    surveyName,
    engagementId,
    engagementName,
}: FormSubmitterProps) => {
    const [currentPage, setCurrentPage] = useState(0);
    const totalPages = savedForm?.components?.length || 0;
    const formioRef = useRef<FormioInstance | null>(null);

    const handleFormReady = (formio: FormioInstance) => {
        formioRef.current = formio;

        const originalNextPage = formio.nextPage.bind(formio);
        formio.nextPage = function () {
            if (!formio.validateCurrentPage()) {
                formio.showErrors();
                return Promise.resolve();
            }
            return originalNextPage();
        };

        const originalSubmit = formio.submit.bind(formio);
        formio.submit = function (...args: unknown[]) {
            let allComponentsValid = true;

            formio.everyComponent((component: FormioComponent) => {
                const componentValid = component.checkValidity(formio.data, true);
                if (!componentValid) {
                    allComponentsValid = false;
                }
            });

            if (!allComponentsValid) {
                formio.showErrors();
                return Promise.resolve();
            }
            return originalSubmit(...args);
        };
    };

    const handleScrollUp = () => {
        window.scrollTo({
            top: 100,
            behavior: 'smooth',
        });
    };

    const handleSurveyLinkClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!surveyId) return;
        const anchor = (event.target as HTMLElement).closest('a');
        if (!anchor?.href) return;
        const pageName = savedForm?.components?.[currentPage]?.title || `Page ${currentPage + 1}`;
        analyticsService.track({
            action: 'link_click',
            widget_type: 'Survey',
            survey_id: surveyId,
            survey_name: surveyName,
            engagement_id: engagementId,
            engagement_name: engagementName,
            step_name: pageName,
            step_number: currentPage + 1,
            step_count: totalPages,
            text: anchor.textContent?.trim() || anchor.href,
            url: anchor.href,
        });
    };

    const handleNextPage = (pageData: PageData) => {
        setCurrentPage(pageData.page);
        handleScrollUp();
        if (surveyId) {
            const pageName = savedForm?.components?.[pageData.page - 1]?.title || `Page ${pageData.page}`;
            analyticsService.track({
                action: 'completed_step',
                survey_id: surveyId,
                survey_name: surveyName,
                engagement_id: engagementId,
                engagement_name: engagementName,
                step_number: pageData.page,
                step_count: totalPages,
                step_name: pageName,
            });
        }
    };

    const handlePrevPage = (pageData: PageData) => {
        setCurrentPage(pageData.page);
        handleScrollUp();
    };

    const handleSubmit = (form: unknown) => {
        handleFormSubmit((form as FormSubmissionData).data);
    };

    return (
        <div className="formio" onClick={handleSurveyLinkClick}>
            <FormStepper currentPage={currentPage} pages={savedForm?.components ?? []} />
            <Form
                form={savedForm || { display: 'wizard' }}
                options={{ noAlerts: true }}
                formReady={handleFormReady}
                onChange={(form: unknown) => handleFormChange(form as FormSubmissionData)}
                onNextPage={handleNextPage}
                onPrevPage={handlePrevPage}
                onSubmit={handleSubmit}
            />
        </div>
    );
};

export default MultiPageForm;

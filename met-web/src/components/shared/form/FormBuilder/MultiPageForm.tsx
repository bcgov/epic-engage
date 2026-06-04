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
    setCustomValidity: (message: string, dirty: boolean) => void;
    dataValue: unknown;
    component: { validate?: { required?: boolean } };
    type: string;
    key: string;
}

interface FormioInstance {
    data: Record<string, unknown>;
    page: number;
    pages: Array<{ everyComponent: (callback: (component: FormioComponent) => void) => void }>;
    everyComponent: (callback: (component: FormioComponent) => void) => void;
    showErrors: (errors?: unknown, triggerEvent?: boolean) => void;
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

        // simplecheckboxes falls through so check it here explicitly.
        const isSimpleCheckboxesRequiredEmpty = (component: FormioComponent): boolean => {
            if (component.type !== 'simplecheckboxes' || !component.component.validate?.required) {
                return false;
            }
            const value = component.dataValue as Record<string, boolean> | null | undefined;
            return !value || !Object.values(value).some(Boolean);
        };

        // simplesurvey falls through to generic required which passes if any one question
        // has a value. Check that every question is answered instead.
        const isSimpleSurveyRequiredIncomplete = (component: FormioComponent): boolean => {
            if (component.type !== 'simplesurvey' || !component.component.validate?.required) {
                return false;
            }
            const value = component.dataValue as Record<string, string> | null | undefined;
            const questions = (component.component as { questions?: Array<{ value: string }> }).questions ?? [];
            return !value || !questions.every((q) => value[q.value]);
        };

        const validateComponentsValid = (component: FormioComponent): boolean => {
            const valid = component.checkValidity(formio.data, true);
            if (isSimpleCheckboxesRequiredEmpty(component)) {
                component.setCustomValidity('This field is required.', true);
                return false;
            }
            if (isSimpleSurveyRequiredIncomplete(component)) {
                component.setCustomValidity('This field is required.', true);
                return false;
            }
            return valid;
        };

        const originalNextPage = formio.nextPage.bind(formio);
        formio.nextPage = function () {
            let currentPageValid = true;

            formio.pages[formio.page].everyComponent((component: FormioComponent) => {
                if (!validateComponentsValid(component)) {
                    currentPageValid = false;
                }
            });

            if (!currentPageValid) {
                formio.showErrors();
                return Promise.resolve();
            }
            return originalNextPage();
        };

        const originalSubmit = formio.submit.bind(formio);
        formio.submit = function (...args: unknown[]) {
            let allComponentsValid = true;

            formio.everyComponent((component: FormioComponent) => {
                if (!validateComponentsValid(component)) {
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

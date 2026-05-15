import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import { Form } from '@formio/react';
import { FormSubmissionData, FormSubmitterProps, FormSubmitHandle } from './types';
import { analyticsService } from 'services/penguinAnalytics';

interface FormioComponent {
    checkValidity: (data: unknown, dirty: boolean, rowData?: unknown) => boolean;
    type: string;
    key: string;
}

interface FormioInstance {
    checkValidity: (data: unknown, dirty: boolean, row: unknown, silentCheck: boolean) => boolean;
    checkAsyncValidity: (data: unknown, dirty: boolean, row: unknown, silentCheck: boolean) => Promise<boolean>;
    submit: (before?: boolean, options?: unknown) => Promise<unknown>;
    executeSubmit: (options?: unknown) => Promise<unknown>;
    validate: () => Promise<boolean>;
    isValid: () => boolean;
    showErrors: (errors?: unknown, triggerEvent?: boolean) => void;
    data: Record<string, unknown>;
    components: FormioComponent[];
    everyComponent: (callback: (component: FormioComponent) => void) => void;
}

const SinglePageForm = forwardRef<FormSubmitHandle, FormSubmitterProps>(
    ({ handleFormChange, savedForm, handleFormSubmit, surveyId, surveyName, engagementId, engagementName }, ref) => {
        const formioRef = useRef<FormioInstance | null>(null);

        useImperativeHandle(ref, () => ({
            triggerSubmit: async () => {
                if (formioRef.current) {
                    const formio = formioRef.current;

                    // Iterate through all components and call their checkValidity
                    // This ensures custom component validation (like simpleranking) is triggered
                    let allComponentsValid = true;
                    formio.everyComponent((component: FormioComponent) => {
                        const componentValid = component.checkValidity(formio.data, true);
                        if (!componentValid) {
                            allComponentsValid = false;
                        }
                    });

                    // Also run form-level checkValidity with actual data
                    const syncValid = formio.checkValidity(formio.data, true, null, false);

                    if (!allComponentsValid || !syncValid) {
                        formio.showErrors();
                        return false;
                    }

                    try {
                        await formio.submit();
                        return true;
                    } catch (error) {
                        console.error('[SinglePageForm] submit error:', error);
                        return false;
                    }
                }
                return false;
            },
        }));

        const handleFormReady = (formio: FormioInstance) => {
            formioRef.current = formio;
        };

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
                    options={{ noAlerts: true }}
                    formReady={handleFormReady}
                    onChange={(form: unknown) => handleFormChange(form as FormSubmissionData)}
                    onSubmit={(form: unknown) => {
                        const formSubmissionData = form as FormSubmissionData;
                        handleFormSubmit(formSubmissionData.data);
                    }}
                />
            </div>
        );
    },
);

SinglePageForm.displayName = 'SinglePageForm';

export default SinglePageForm;

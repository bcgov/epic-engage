export interface FormSubmitterProps {
    handleFormChange: (form: FormSubmissionData) => void;
    handleFormSubmit: (data: unknown) => void;
    savedForm?: FormBuilderData;
    surveyId?: string;
    surveyName?: string;
    engagementId?: string;
    engagementName?: string;
}

export interface FormSubmitHandle {
    /** Triggers FormIO validation and submits if valid. Returns true if submitted, false if validation failed. */
    triggerSubmit: () => Promise<boolean>;
}

export interface FormBuilderProps {
    handleFormChange: (form: FormBuilderData) => void;
    savedForm?: FormBuilderData;
    isLoading?: boolean;
}

export interface FormInfo {
    title: string;
    [key: string]: unknown;
}

export interface FormBuilderData {
    display: string;
    components: Array<FormInfo>;
}
export interface FormSubmissionData {
    data: unknown;
    isValid: boolean;
}

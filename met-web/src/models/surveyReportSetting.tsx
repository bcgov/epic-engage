export interface SurveyReportSetting {
    id: number;
    survey_id: number;
    question_id: number;
    question_key: string;
    question_type: string;
    question: string;
    display: boolean;
    description?: string | null;
    export_display: boolean;
    export_description?: string | null;
}

// PATCH body: only the fields sent are changed.
export type SurveyReportSettingUpdate = Pick<SurveyReportSetting, 'id'> &
    Partial<Pick<SurveyReportSetting, 'display' | 'description' | 'export_display' | 'export_description'>>;

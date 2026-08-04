interface ResultData {
    value: string;
    count: number;
}

// Type-aware result interfaces used by the chart components
export interface FlatResultItem {
    value: string;
    count: number;
}

export interface MatrixResultRow {
    label: string;
    pcts: number[];
    n: number;
}

export interface TypedSurveyData {
    label: string;
    position: number;
    key: string;
    type: string;
    // Distinct people who answered this question, counted by the backend. Optional because the
    // comments dataset comes from met-api rather than analytics-api and carries no such count.
    respondent_count?: number;
    // The wordings of a likert question's scale, in order, as the survey author wrote them
    // ("Not effective".."Very effective"). Only present on likert matrix questions.
    scale_labels?: string[];
    result: FlatResultItem[] | MatrixResultRow[];
}

export interface TypedSurveyResultData {
    data: TypedSurveyData[];
}

interface SurveyData {
    label: string;
    position: number;
    result: ResultData[];
}

export interface SurveyResultData {
    data: SurveyData[];
}

export const createSurveyResultData = (): SurveyResultData => {
    return {
        data: [
            {
                label: '',
                position: 0,
                result: [{ value: '', count: 0 }],
            },
        ],
    };
};

export const defaultData = [
    {
        label: '',
        position: 0,
        result: [
            {
                value: '',
                count: 0,
            },
        ],
    },
];

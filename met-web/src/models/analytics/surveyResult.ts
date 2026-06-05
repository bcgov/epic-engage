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

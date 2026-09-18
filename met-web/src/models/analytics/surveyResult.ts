interface ResultData {
    value: string;
    count: number;
}

// Type-aware result interfaces used by the chart components
export interface FlatResultItem {
    value: string;
    count: number;
}

// A Likert value's place on its scale, in rank order. Set by the survey author in the builder.
export type LikertClassification = 'neg3' | 'neg2' | 'neg1' | 'neutral' | 'pos1' | 'pos2' | 'pos3';

export interface LikertScalePoint {
    label: string;
    classification: LikertClassification | 'notSure' | null;
}

export interface MatrixResultRow {
    label: string;
    pcts: number[];
    n: number;
    not_sure_pct?: number | null;
}

export interface TypedSurveyData {
    label: string;
    position: number;
    key: string;
    type: string;
    respondent_count?: number;
    scale_labels?: string[];
    scale?: LikertScalePoint[];
    has_not_sure?: boolean;
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

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
    // Matrix questions only: the answer scale in survey order, e.g.
    // ['Least important', 'Neutral', 'Somewhat important', 'Important', 'Most important'].
    scale?: string[];
    // Number of people who answered this question. Larger than the sum of the answer counts
    // is impossible, smaller happens on checkbox questions where one person picks several options.
    respondents?: number;
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

export const isMatrixResultRow = (item: FlatResultItem | MatrixResultRow): item is MatrixResultRow => 'pcts' in item;

/**
 * Drop the matrix questions (likert, rank order) from a survey result. The bar charts predate
 * matrix questions and can only draw value/count answers.
 */
export const toFlatSurveyResultData = (data: SurveyResultData | TypedSurveyResultData): SurveyResultData => ({
    data: (data.data as TypedSurveyData[])
        .map((question) => ({
            label: question.label,
            position: question.position,
            result: (question.result ?? []).filter((item): item is FlatResultItem => !isMatrixResultRow(item)),
        }))
        .filter((question) => question.result.length > 0),
});

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

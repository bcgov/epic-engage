import { FormBuilderData, FormInfo } from 'components/shared/form/FormBuilder/types';
import { SurveyReportSetting } from 'models/surveyReportSetting';
import { LikertClassification, LikertScalePoint, TypedSurveyData } from 'models/analytics/surveyResult';

// Rank order and the out-of-scale Not sure key, mirroring analytics-api's _LIKERT_RANK so a
// preview built here matches what the ETL will serve once the survey has responses.
const LIKERT_RANK: LikertClassification[] = ['neg3', 'neg2', 'neg1', 'neutral', 'pos1', 'pos2', 'pos3'];
const NOT_SURE = 'notSure';

const SIMPLE_SURVEY = 'simplesurvey';

interface LikertValue {
    label?: string;
    classification?: string;
}

interface LikertQuestion {
    label?: string;
}

/** Depth-first walk so a component is found whether the form is a wizard or a flat form. */
const findComponent = (components: FormInfo[] | undefined, id: string): FormInfo | undefined => {
    for (const component of components ?? []) {
        if (String(component.id) === id) {
            return component;
        }
        const nested = findComponent(component.components as FormInfo[] | undefined, id);
        if (nested) {
            return nested;
        }
    }
    return undefined;
};

/**
 * Split a Likert scale into its ranked points and its Not sure point.
 *
 * Mirrors _order_likert_scale in analytics-api: a missing, unknown or duplicated classification
 * falls back to the stored order with no Not sure column, which is the same shape that keeps
 * resolveLikertScale on its legacy path.
 */
const orderScale = (values: LikertValue[]): { scale: LikertScalePoint[]; hasNotSure: boolean } => {
    const classifications = values.map((value) => value.classification);
    const known = [...LIKERT_RANK, NOT_SURE];
    const hasDuplicate = new Set(classifications).size !== classifications.length;
    const allKnown = classifications.every(
        (classification) => classification !== undefined && known.includes(classification),
    );

    const asPoint = (value: LikertValue): LikertScalePoint => ({
        label: value.label ?? '',
        classification: (value.classification ?? null) as LikertScalePoint['classification'],
    });

    if (hasDuplicate || !allKnown) {
        return { scale: values.map(asPoint), hasNotSure: false };
    }

    return {
        scale: values
            .filter((value) => value.classification !== NOT_SURE)
            .map(asPoint)
            .sort(
                (a, b) =>
                    LIKERT_RANK.indexOf(a.classification as LikertClassification) -
                    LIKERT_RANK.indexOf(b.classification as LikertClassification),
            ),
        hasNotSure: classifications.includes(NOT_SURE),
    };
};

/**
 * Build a zeroed stand-in for a Likert question so the report settings preview can draw the
 * matrix before the survey has any analytics data - a survey the ETL has never run for has no
 * question or scale rows at all, not merely no responses.
 *
 * Returns null when there is nothing to draw, leaving the caller's "results will appear here"
 * message in place.
 */
export const buildEmptyLikertQuestion = (
    formDefinition: FormBuilderData | undefined,
    setting: SurveyReportSetting,
): TypedSurveyData | null => {
    if (setting.question_type !== SIMPLE_SURVEY) {
        return null;
    }

    const component = findComponent(formDefinition?.components, String(setting.question_id));
    const values = (component?.values ?? []) as LikertValue[];
    const questions = (component?.questions ?? []) as LikertQuestion[];
    if (!component || !values.length || !questions.length) {
        return null;
    }

    const { scale, hasNotSure } = orderScale(values);

    return {
        label: (component.label as string) ?? setting.question,
        position: 0,
        key: setting.question_key,
        type: SIMPLE_SURVEY,
        respondent_count: 0,
        scale_labels: scale.map((point) => point.label),
        scale,
        has_not_sure: hasNotSure,
        result: questions.map((question) => ({
            label: question.label ?? '',
            pcts: scale.map(() => 0),
            n: 0,
            not_sure_pct: hasNotSure ? 0 : null,
        })),
    };
};

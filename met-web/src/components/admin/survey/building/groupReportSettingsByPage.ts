import { FormBuilderData, FormInfo } from 'components/shared/form/FormBuilder/types';
import { SurveyReportSetting } from 'models/surveyReportSetting';
import { ConditionalLink } from 'components/public/dashboard/surveyPages';

// A top-level question and any conditionally-shown follow-ups (e.g. an "Other, please specify"
// question) nested under it - follow-ups are never their own top-level item.
export interface ReportSettingsPageItem {
    setting: SurveyReportSetting;
    followUps: SurveyReportSetting[];
}

export interface ReportSettingsPage {
    title: string;
    items: ReportSettingsPageItem[];
    // FormStepper (shared with the public dashboard) takes FormInfo[], which requires this.
    [key: string]: unknown;
}

// A simplesurvey (Likert) component holds several sub-questions; each one is tracked as its
// own report setting keyed by `${component.id}-${question.value}`, matching how the backend's
// ReportSettingService keys these rows (see report_setting_service.py).
const questionKeysForComponents = (components: FormInfo[]): string[] => {
    const keys: string[] = [];
    components.forEach((component) => {
        if (component.type === 'simplesurvey') {
            const subQuestions = (component.questions as Array<{ value: string }>) ?? [];
            subQuestions.forEach((subQuestion) => keys.push(`${component.id}-${subQuestion.value}`));
        } else {
            keys.push(component.id as string);
        }
    });
    return keys;
};

const orderSettingsForComponents = (components: FormInfo[], settings: SurveyReportSetting[]): SurveyReportSetting[] => {
    const orderedKeys = questionKeysForComponents(components);
    return orderedKeys
        .map((key) => settings.find((setting) => String(setting.question_id) === key))
        .filter((setting): setting is SurveyReportSetting => Boolean(setting));
};

// Splits an ordered list of settings into top-level items with their conditional follow-ups
// nested underneath, using conditional_links to find each follow-up's trigger question.
const groupIntoItems = (
    orderedSettings: SurveyReportSetting[],
    conditionalLinks: Record<string, ConditionalLink>,
): ReportSettingsPageItem[] => {
    const items: ReportSettingsPageItem[] = orderedSettings
        .filter((setting) => !conditionalLinks[setting.question_key])
        .map((setting) => ({ setting, followUps: [] }));
    const itemByTriggerKey = new Map(items.map((item) => [item.setting.question_key, item]));

    orderedSettings.forEach((setting) => {
        const link = conditionalLinks[setting.question_key];
        if (!link) {
            return;
        }
        const triggerItem = itemByTriggerKey.get(link.trigger_key);
        if (triggerItem) {
            triggerItem.followUps.push(setting);
        } else {
            // Trigger question isn't on this page (shouldn't normally happen) - show standalone.
            items.push({ setting, followUps: [] });
        }
    });

    return items;
};

export const groupReportSettingsByPage = (
    formDefinition: FormBuilderData | undefined,
    settings: SurveyReportSetting[],
    conditionalLinks: Record<string, ConditionalLink> = {},
): ReportSettingsPage[] => {
    const isMultiPage = formDefinition?.display === 'wizard';

    if (isMultiPage) {
        const pages = (formDefinition?.components as FormInfo[]) ?? [];
        return pages.map((page, index) => ({
            title: (page.title as string) || `Page ${index + 1}`,
            items: groupIntoItems(
                orderSettingsForComponents((page.components as FormInfo[]) ?? [], settings),
                conditionalLinks,
            ),
        }));
    }

    return [
        {
            title: 'Questions',
            items: groupIntoItems(
                orderSettingsForComponents((formDefinition?.components as FormInfo[]) ?? [], settings),
                conditionalLinks,
            ),
        },
    ];
};

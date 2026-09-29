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

// Every question is one report setting keyed by its component id, a simplesurvey (Likert) matrix
// included: its rows share the one setting held against the component, matching how the backend's
// ReportSettingService keys these rows (see report_setting_service.py).
const questionKeysForComponents = (components: FormInfo[]): string[] =>
    components.map((component) => component.id as string);

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

// Question types whose answers are free text - the only ones the public/proponent comment export
// carries. Matches FormIoComponentType.TEXTAREA/TEXTFIELD in met-api.
export const FREE_TEXT_QUESTION_TYPES = ['simpletextarea', 'simpletextfield'];

// A free-text question and, when it's a conditional follow-up, the question that triggers it.
export interface FreeTextPageItem {
    setting: SurveyReportSetting;
    trigger?: SurveyReportSetting;
}

export interface FreeTextPage {
    title: string;
    items: FreeTextPageItem[];
    [key: string]: unknown;
}

// The report pages cut down to their free-text questions, in page order, with pages that have none
// dropped. A free-text follow-up is listed on its own even when its trigger isn't free text
// (e.g. a radio's "Other, please specify"), carrying that trigger so it can be named.
export const groupFreeTextSettingsByPage = (
    formDefinition: FormBuilderData | undefined,
    settings: SurveyReportSetting[],
    conditionalLinks: Record<string, ConditionalLink> = {},
): FreeTextPage[] => {
    const isFreeText = (setting: SurveyReportSetting) => FREE_TEXT_QUESTION_TYPES.includes(setting.question_type);
    return groupReportSettingsByPage(formDefinition, settings, conditionalLinks)
        .map((page) => ({
            title: page.title,
            items: page.items.flatMap(({ setting, followUps }) => [
                ...(isFreeText(setting) ? [{ setting }] : []),
                ...followUps.filter(isFreeText).map((followUp) => ({ setting: followUp, trigger: setting })),
            ]),
        }))
        .filter((page) => page.items.length > 0);
};

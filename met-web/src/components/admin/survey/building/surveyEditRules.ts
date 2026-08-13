import { format } from 'date-fns';
import { Engagement } from 'models/engagement';
import { EngagementStatus } from 'constants/engagementStatus';

export const SURVEY_LOCKED_MESSAGE =
    'This survey already went live as part of a published Engagement and cannot be modified.';
export const ENGAGEMENT_SCHEDULED_MESSAGE =
    'Engagement has been scheduled. Please be careful while editing the survey.';
export const ENGAGEMENT_PUBLISHED_MESSAGE = 'Engagement already published. Please be careful while editing the survey.';

export interface SurveyEditRules {
    /** False locks the whole builder: no auto-save, no save buttons, read-only tabs. */
    canEdit: boolean;
    /** Banner shown above the tabs for the whole time the survey is open. */
    message: string | null;
    severity: 'warning' | 'error';
}

const EDITABLE: SurveyEditRules = { canEdit: true, message: null, severity: 'warning' };
const LOCKED: SurveyEditRules = { canEdit: false, message: SURVEY_LOCKED_MESSAGE, severity: 'error' };
const editableWith = (message: string): SurveyEditRules => ({ canEdit: true, message, severity: 'warning' });

const today = () => format(new Date(), 'yyyy-MM-dd');
const asDate = (value: string) => value.slice(0, 10);

// Whether the engagement's start date has arrived. For an engagement that has been published that
// means its survey reached the public.
const hasGoneLive = (engagement: Engagement) =>
    Boolean(engagement.start_date) && today() >= asDate(engagement.start_date);

// Whether the submission window has ended.
const hasClosed = (engagement: Engagement) => Boolean(engagement.end_date) && today() > asDate(engagement.end_date);

/**
 * Rules for what an admin is allowed to do with a survey, based on the engagement it is attached to.
 * A survey with no engagement behind it can always be edited in full.
 */
export const getSurveyEditRules = (engagement: Engagement | null | undefined): SurveyEditRules => {
    if (!engagement) {
        return EDITABLE;
    }

    switch (engagement.status_id) {
        case EngagementStatus.Draft:
            return EDITABLE;
        case EngagementStatus.Scheduled:
            // A scheduled engagement isn't published yet
            return hasGoneLive(engagement) ? LOCKED : editableWith(ENGAGEMENT_SCHEDULED_MESSAGE);
        case EngagementStatus.Published:
            // Editable until the submission window ends. While it is open the survey can still be
            // edited with care. After it is closed to editing.
            return hasClosed(engagement) ? LOCKED : editableWith(ENGAGEMENT_PUBLISHED_MESSAGE);
        case EngagementStatus.Unpublished:
            // Pulled back before it ever went live, the survey is still safe to edit; pulled back
            // afterwards it is not.
            return hasGoneLive(engagement) ? LOCKED : editableWith(ENGAGEMENT_PUBLISHED_MESSAGE);
        case EngagementStatus.Closed:
        default:
            return LOCKED;
    }
};

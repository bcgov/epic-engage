import { createDefaultEngagement } from 'models/engagement';
import { EngagementStatus } from 'constants/engagementStatus';
import {
    getSurveyEditRules,
    SURVEY_LOCKED_MESSAGE,
    ENGAGEMENT_SCHEDULED_MESSAGE,
    ENGAGEMENT_PUBLISHED_MESSAGE,
} from 'components/admin/survey/building/surveyEditRules';

const PAST = '2020-01-01';
const FUTURE = '2099-01-01';

// Defaults to an engagement whose submission window is open right now; each test moves whichever
// date it is about.
const engagement = (statusId: number, overrides = {}) => ({
    ...createDefaultEngagement(),
    status_id: statusId,
    start_date: PAST,
    end_date: FUTURE,
    ...overrides,
});

describe('Survey edit rules', () => {
    test('A survey with no engagement is fully editable with no message', () => {
        expect(getSurveyEditRules(null)).toEqual({ canEdit: true, message: null, severity: 'warning' });
    });

    test('A draft engagement is fully editable with no message', () => {
        const rules = getSurveyEditRules(engagement(EngagementStatus.Draft, { start_date: FUTURE }));
        expect(rules.canEdit).toBe(true);
        expect(rules.message).toBeNull();
    });

    test('A scheduled engagement is editable with a scheduled warning', () => {
        const rules = getSurveyEditRules(engagement(EngagementStatus.Scheduled, { start_date: FUTURE }));
        expect(rules).toEqual({ canEdit: true, message: ENGAGEMENT_SCHEDULED_MESSAGE, severity: 'warning' });
    });

    test('A published engagement whose start date has not arrived is still editable', () => {
        const rules = getSurveyEditRules(engagement(EngagementStatus.Published, { start_date: FUTURE }));
        expect(rules).toEqual({ canEdit: true, message: ENGAGEMENT_PUBLISHED_MESSAGE, severity: 'warning' });
    });

    test('An open engagement is editable with a published warning', () => {
        const rules = getSurveyEditRules(engagement(EngagementStatus.Published));
        expect(rules).toEqual({ canEdit: true, message: ENGAGEMENT_PUBLISHED_MESSAGE, severity: 'warning' });
    });

    test('A survey stays editable for the whole of the end date', () => {
        const endsToday = new Date().toISOString().slice(0, 10);
        expect(getSurveyEditRules(engagement(EngagementStatus.Published, { end_date: endsToday })).canEdit).toBe(true);
    });

    test('A closed engagement locks the survey', () => {
        const rules = getSurveyEditRules(engagement(EngagementStatus.Closed));
        expect(rules).toEqual({ canEdit: false, message: SURVEY_LOCKED_MESSAGE, severity: 'error' });
    });

    test('A published engagement past its end date locks the survey', () => {
        const rules = getSurveyEditRules(engagement(EngagementStatus.Published, { end_date: PAST }));
        expect(rules.canEdit).toBe(false);
        expect(rules.message).toBe(SURVEY_LOCKED_MESSAGE);
    });

    test('An unpublished engagement is editable only if it never went live', () => {
        expect(getSurveyEditRules(engagement(EngagementStatus.Unpublished, { start_date: FUTURE })).canEdit).toBe(true);
        expect(getSurveyEditRules(engagement(EngagementStatus.Unpublished)).canEdit).toBe(false);
    });

    test('A scheduled engagement whose start date has passed locks the survey', () => {
        expect(getSurveyEditRules(engagement(EngagementStatus.Scheduled)).canEdit).toBe(false);
    });
});

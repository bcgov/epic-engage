import { canViewInternalReport } from 'services/userService/reportAccess';
import { USER_ROLES } from 'services/userService/constants';

const TEAM_MEMBER_ROLES = [USER_ROLES.ACCESS_DASHBOARD, USER_ROLES.VIEW_ASSIGNED_ENGAGEMENTS];

describe('canViewInternalReport', () => {
    test('a holder of view_all_survey_results may open any engagement', () => {
        expect(canViewInternalReport([USER_ROLES.VIEW_ALL_SURVEY_RESULTS], [], 7)).toBe(true);
    });

    test('a Team Member may open an engagement they are assigned to', () => {
        expect(canViewInternalReport(TEAM_MEMBER_ROLES, [3, 7], 7)).toBe(true);
    });

    test('a Team Member may not open an engagement they are not assigned to', () => {
        expect(canViewInternalReport(TEAM_MEMBER_ROLES, [3], 7)).toBe(false);
    });
});

import { USER_ROLES } from './constants';

export const canViewInternalReport = (roles: string[], assignedEngagements: number[], engagementId: number) =>
    roles.includes(USER_ROLES.VIEW_ALL_SURVEY_RESULTS) || assignedEngagements.includes(engagementId);

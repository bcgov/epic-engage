import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReportButtons } from 'components/admin/survey/listing/ReportButtons';
import { createDefaultSurvey, SurveyListItem } from 'models/survey';
import { createDefaultEngagement } from 'models/engagement';
import { SubmissionStatus } from 'constants/engagementStatus';
import { USER_ROLES } from 'services/userService/constants';

const mockUser = { roles: [] as string[], assignedEngagements: [] as number[] };

jest.mock('hooks', () => ({
    useAppSelector: (selector: (state: unknown) => unknown) => selector({ user: mockUser }),
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
}));

const survey = {
    ...createDefaultSurvey(),
    id: 11,
    engagement: { ...createDefaultEngagement(), id: 7, submission_status: SubmissionStatus.Open },
} as unknown as SurveyListItem;

const internalReportButton = () => screen.getByRole('button', { name: 'Internal Report' });

describe('ReportButtons', () => {
    beforeEach(() => {
        mockUser.roles = [USER_ROLES.ACCESS_DASHBOARD];
    });

    test('enables the Internal Report for a Team Member assigned to the engagement', () => {
        mockUser.assignedEngagements = [7];
        render(<ReportButtons survey={survey} />);
        expect(internalReportButton()).toBeEnabled();
    });

    test('disables the Internal Report for a Team Member assigned elsewhere', () => {
        mockUser.assignedEngagements = [3];
        render(<ReportButtons survey={survey} />);
        expect(internalReportButton()).toBeDisabled();
    });
});

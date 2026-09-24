import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from 'redux/store';
import { DashboardHeaderCard } from 'components/public/dashboard/DashboardHeaderCard';
import { DashboardContext } from 'components/public/dashboard/DashboardContext';
import { chartFileNames, chartZipName, selectPublicCharts } from 'components/public/dashboard/exportCharts';
import { TypedSurveyData } from 'models/analytics/surveyResult';
import { SurveyReportSetting } from 'models/surveyReportSetting';
import { USER_ROLES } from 'services/userService/constants';
import { assignedEngagements, userAuthentication, userDetails, userRoles } from 'services/userService/userSlice';
import { openEngagement } from '../factory';

jest.mock('components/public/dashboard/ChartsPngExport', () => ({
    __esModule: true,
    ChartsPngExport: () => null,
}));
jest.mock('services/analytics/aggregatorService', () => ({
    getAggregatorData: jest.fn(() => Promise.resolve({ value: 42 })),
}));
jest.mock('services/analytics/mapService', () => ({
    getMapData: jest.fn(() => Promise.resolve({ marker_label: 'Victoria' })),
}));
jest.mock('services/analytics/userResponseDetailService', () => ({
    getUserResponseDetailByMonth: jest.fn(() => Promise.resolve([])),
}));

const question = (key: string, type: string): TypedSurveyData => ({
    key,
    type,
    label: key,
    position: 0,
    result: [],
});

const setting = (question_key: string, display: boolean): SurveyReportSetting => ({
    id: 0,
    survey_id: 1,
    question_id: 0,
    question_key,
    question_type: '',
    question: question_key,
    display,
});

describe('selectPublicCharts', () => {
    const questions = [
        question('shown', 'simpleradios'),
        question('hidden', 'simplesurvey'),
        question('noSetting', 'simplecheckboxes'),
        question('comment', 'simpletextarea'),
        question('ranked', 'simpleranking'),
    ];
    const settings = [
        setting('shown', true),
        setting('hidden', false),
        setting('comment', true),
        setting('ranked', true),
    ];

    it('keeps only charts shown in the public report', () => {
        expect(selectPublicCharts(questions, settings).map((q) => q.key)).toEqual(['shown', 'ranked']);
    });
});

describe('export file names', () => {
    it('numbers each question type separately, in survey order', () => {
        const charts = [question('a', 'simplesurvey'), question('b', 'simpleselect'), question('c', 'simplesurvey')];
        expect(chartFileNames('Big Delicious Ranch', charts)).toEqual([
            'BigDeliciousRanch_LikertMatrix_1.png',
            'BigDeliciousRanch_Dropdown_1.png',
            'BigDeliciousRanch_LikertMatrix_2.png',
        ]);
    });

    it('names the zip after the engagement and export date', () => {
        expect(chartZipName("Big Delicious Ranch - EA's", '2026-09-23')).toBe(
            'BigDeliciousRanchEAs_SurveyCharts_2026-09-23.zip',
        );
    });
});

describe('Internal report export menu', () => {
    const renderHeader = (group: string, assigned: number[]) => {
        store.dispatch(userAuthentication(true));
        store.dispatch(userRoles([USER_ROLES.VIEW_ALL_SURVEY_RESULTS]));
        store.dispatch(userDetails({ sub: '', email_verified: true, preferred_username: '', groups: [group] }));
        store.dispatch(assignedEngagements(assigned));
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <DashboardContext.Provider
                        value={{
                            engagement: openEngagement,
                            isEngagementLoading: false,
                            dashboardType: 'internal',
                            originSurvey: null,
                        }}
                    >
                        <DashboardHeaderCard engagement={openEngagement} engagementIsLoading={false} />
                    </DashboardContext.Provider>
                </MemoryRouter>
            </Provider>,
        );
    };

    const openMenu = async () => {
        fireEvent.click(await screen.findByRole('button', { name: /export/i }));
        await waitFor(() => expect(screen.getByText('PNG / ZIP')).toBeInTheDocument());
    };

    it('offers Superusers both exports', async () => {
        renderHeader('/ENGAGE/EAO_IT_ADMIN', []);
        await openMenu();
        expect(screen.getByText('Excel Data Export')).toBeInTheDocument();
        expect(screen.getByText('Download charts as a ZIP bundle')).toBeInTheDocument();
    });

    it('offers an assigned team member only the chart export', async () => {
        renderHeader('/ENGAGE/EAO_TEAM_MEMBER', [openEngagement.id]);
        await openMenu();
        expect(screen.queryByText('Excel Data Export')).not.toBeInTheDocument();
    });

    it('offers a team member not assigned to the engagement no export', async () => {
        renderHeader('/ENGAGE/EAO_TEAM_MEMBER', []);
        await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
        expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    });
});

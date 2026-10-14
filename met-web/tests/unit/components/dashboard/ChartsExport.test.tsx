import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from 'redux/store';
import { DashboardHeaderCard } from 'components/public/dashboard/DashboardHeaderCard';
import { DashboardContext } from 'components/public/dashboard/DashboardContext';
import {
    chartFileName,
    chartFileNames,
    chartZipName,
    selectPublicCharts,
} from 'components/public/dashboard/exportCharts';
import { TypedSurveyData } from 'models/analytics/surveyResult';
import { SurveyReportSetting } from 'models/surveyReportSetting';
import * as commentService from 'services/commentService';
import * as surveyService from 'services/surveyService';
import * as reportSettingsService from 'services/surveyService/reportSettingsService';
import * as surveyResultService from 'services/analytics/surveyResult';
import { USER_ROLES } from 'services/userService/constants';
import * as utils from 'utils';
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
    export_display: true,
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

    it('names a single chart after the engagement and its question', () => {
        const chart = { ...question('a', 'simpleradios'), label: 'What is your age?' };
        expect(chartFileName('Big Delicious Ranch', chart)).toBe('BigDeliciousRanch_Whatisyourage.png');
    });

    it('caps a long question label in a single chart name', () => {
        const chart = { ...question('a', 'simpleradios'), label: 'x'.repeat(200) };
        expect(chartFileName('Ranch', chart)).toBe(`Ranch_${'x'.repeat(60)}.png`);
    });

    it('falls back to the question type when the label has no letters or digits', () => {
        const chart = { ...question('a', 'simplesurvey'), label: '???' };
        expect(chartFileName('Ranch', chart)).toBe('Ranch_LikertMatrix.png');
    });

    it('names the zip after the engagement and export date', () => {
        expect(chartZipName("Big Delicious Ranch - EA's", '2026-09-23')).toBe(
            'BigDeliciousRanchEAs_SurveyCharts_2026-09-23.zip',
        );
    });
});

describe('Internal report export menu', () => {
    const GROUP_ROLES: Record<string, string[]> = {
        '/ENGAGE/EAO_IT_ADMIN': [USER_ROLES.ACCESS_DASHBOARD, USER_ROLES.VIEW_ALL_SURVEY_RESULTS],
        '/ENGAGE/EAO_TEAM_MEMBER': [USER_ROLES.ACCESS_DASHBOARD, USER_ROLES.EXPORT_PROPONENT_COMMENT_SHEET],
    };
    const renderHeader = (group: string, assigned: number[]) => {
        store.dispatch(userAuthentication(true));
        store.dispatch(userRoles(GROUP_ROLES[group]));
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
        expect(screen.getByText('Public/Proponent Comment Export')).toBeInTheDocument();
        expect(screen.getByText('Comments safe to share with the public and Proponents')).toBeInTheDocument();
    });

    it('offers an assigned team member only the chart export', async () => {
        renderHeader('/ENGAGE/EAO_TEAM_MEMBER', [openEngagement.id]);
        await openMenu();
        expect(screen.queryByText('Excel Data Export')).not.toBeInTheDocument();
        expect(screen.getByText('Public/Proponent Comment Export')).toBeInTheDocument();
    });

    it('downloads the Public/Proponent comment export for the engagement survey', async () => {
        const getSheet = jest
            .spyOn(commentService, 'getProponentCommentSheet')
            .mockResolvedValue({ data: new Blob() } as never);
        const download = jest.spyOn(utils, 'downloadFile').mockImplementation(() => undefined);
        renderHeader('/ENGAGE/EAO_TEAM_MEMBER', [openEngagement.id]);
        await openMenu();

        fireEvent.click(screen.getByText('Public/Proponent Comment Export'));

        await waitFor(() => expect(download).toHaveBeenCalled());
        expect(getSheet).toHaveBeenCalledWith({ survey_id: openEngagement.surveys[0].id });
        expect(download.mock.calls[0][1]).toMatch(
            /^Open Engagement - Public Proponent Export - \d{4}-\d{2}-\d{2}\.xlsx$/,
        );
    });

    it('marks the data export as internal', async () => {
        renderHeader('/ENGAGE/EAO_IT_ADMIN', []);
        await openMenu();
        expect(screen.getByText('INTERNAL')).toBeInTheDocument();
    });

    it('asks Superusers to confirm the internal data export before downloading', async () => {
        const getSheet = jest
            .spyOn(surveyService, 'getDashboardDataSheet')
            .mockResolvedValue({ data: new Blob() } as never);
        const download = jest.spyOn(utils, 'downloadFile').mockImplementation(() => undefined);
        renderHeader('/ENGAGE/EAO_IT_ADMIN', []);
        await openMenu();

        fireEvent.click(screen.getByText('Excel Data Export'));

        expect(
            screen.getByText(
                'This export contains raw survey responses and is for internal use only. Do not share this file externally.',
            ),
        ).toBeInTheDocument();
        expect(getSheet).not.toHaveBeenCalled();
        expect(screen.getByText('PNG / ZIP').closest('li')).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByText('Public/Proponent Comment Export').closest('li')).toHaveAttribute(
            'aria-disabled',
            'true',
        );

        fireEvent.click(screen.getByRole('button', { name: /yes, download/i }));

        await waitFor(() => expect(download).toHaveBeenCalled());
        expect(getSheet).toHaveBeenCalledWith(openEngagement.surveys[0].id);
    });

    it('restores the export options when the warning is cancelled', async () => {
        const getSheet = jest.spyOn(surveyService, 'getDashboardDataSheet');
        renderHeader('/ENGAGE/EAO_IT_ADMIN', []);
        await openMenu();

        fireEvent.click(screen.getByText('Excel Data Export'));
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

        expect(screen.queryByRole('button', { name: /yes, download/i })).not.toBeInTheDocument();
        expect(screen.getByText('PNG / ZIP').closest('li')).not.toHaveAttribute('aria-disabled');
        expect(getSheet).not.toHaveBeenCalled();
    });

    it('shows the public-charts disclaimer before exporting charts', async () => {
        const getResults = jest
            .spyOn(surveyResultService, 'getSurveyResultData')
            .mockResolvedValue({ data: [] } as never);
        const getSettings = jest.spyOn(reportSettingsService, 'fetchSurveyReportSettings').mockResolvedValue([]);
        renderHeader('/ENGAGE/EAO_TEAM_MEMBER', [openEngagement.id]);
        await openMenu();

        fireEvent.click(screen.getByText('PNG / ZIP'));

        expect(
            screen.getByText('Only charts marked for public report view will be included in this export.'),
        ).toBeInTheDocument();
        expect(screen.getByText('Public/Proponent Comment Export').closest('li')).toHaveAttribute(
            'aria-disabled',
            'true',
        );
        expect(getResults).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: /^download$/i }));

        await waitFor(() => expect(getSettings).toHaveBeenCalledWith(String(openEngagement.surveys[0].id)));
        expect(getResults).toHaveBeenCalled();
    });

    it('offers a team member not assigned to the engagement no export', async () => {
        renderHeader('/ENGAGE/EAO_TEAM_MEMBER', []);
        await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
        expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    });
});

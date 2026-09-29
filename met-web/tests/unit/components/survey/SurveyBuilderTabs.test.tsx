import React from 'react';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from 'redux/store';
import { setupEnv } from '../setEnvVars';
import * as surveyService from 'services/surveyService';
import * as engagementService from 'services/engagementService';
import { Engagement } from 'models/engagement';
import { EngagementStatus } from 'constants/engagementStatus';
import { Survey } from 'models/survey';
import SurveyFormBuilder from 'components/admin/survey/building';

jest.mock('axios');

jest.mock('hooks', () => ({
    ...jest.requireActual('hooks'),
    useAppDispatch: jest.fn(() => jest.fn()),
}));

jest.mock('components/shared/form/FormBuilder', () => ({
    __esModule: true,
    default: () => <div data-testid="form-builder" />,
}));

// Stand-ins for the settings panels: each save() is a mock the test controls, and the panel's
// own buttons call the same props the real panels do.
const reportSave = jest.fn();
const exportSave = jest.fn();

jest.mock('components/admin/survey/building/ReportSettingsPanel', () => ({
    ReportSettingsPanel: jest
        .requireActual('react')
        .forwardRef((props: { onNext: () => void; focusQuestionKey?: string }, ref: React.Ref<unknown>) => {
            jest.requireActual('react').useImperativeHandle(ref, () => ({ save: reportSave }));
            return (
                <div data-testid="report-panel" data-focus={props.focusQuestionKey ?? ''}>
                    <button onClick={async () => (await reportSave()) && props.onNext()}>
                        Next: Public/Proponent export settings
                    </button>
                </div>
            );
        }),
}));

jest.mock('components/admin/survey/building/ExportSettingsPanel', () => ({
    ExportSettingsPanel: jest
        .requireActual('react')
        .forwardRef((props: { onGoToReport: (key: string) => void }, ref: React.Ref<unknown>) => {
            jest.requireActual('react').useImperativeHandle(ref, () => ({ save: exportSave }));
            return (
                <div data-testid="export-panel">
                    <button onClick={() => props.onGoToReport('key4')}>Go to Public report settings</button>
                </div>
            );
        }),
}));

const survey = {
    id: 1,
    name: 'Survey',
    form_json: { display: 'form', components: [] },
    is_hidden: false,
    is_template: false,
    engagement_id: null,
} as unknown as Survey;

const renderBuilder = (search = '') =>
    render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[`/surveys/1/build${search}`]}>
                <Routes>
                    <Route path="/surveys/:surveyId/build" element={<SurveyFormBuilder />} />
                    <Route path="/surveys" element={<div>Survey listing</div>} />
                </Routes>
            </MemoryRouter>
        </Provider>,
    );

const tab = (name: RegExp) => screen.getByRole('tab', { name });
const EXPORT_TAB = /Public\/Proponent export settings/;
const REPORT_TAB = /Public report settings/;

describe('Survey builder tabs', () => {
    beforeEach(() => {
        setupEnv();
        jest.clearAllMocks();
        jest.spyOn(surveyService, 'getSurvey').mockResolvedValue(survey);
        jest.spyOn(surveyService, 'putSurvey').mockResolvedValue(survey);
        reportSave.mockResolvedValue(true);
        exportSave.mockResolvedValue(true);
    });

    test('The export tab is locked until the report tab has been opened', async () => {
        renderBuilder();
        await waitFor(() => expect(screen.getByTestId('form-builder')).toBeInTheDocument());

        expect(tab(EXPORT_TAB)).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(tab(EXPORT_TAB));
        expect(screen.queryByTestId('export-panel')).not.toBeInTheDocument();

        fireEvent.click(tab(REPORT_TAB));
        await waitFor(() => expect(screen.getByTestId('report-panel')).toBeInTheDocument());
        expect(tab(EXPORT_TAB)).not.toHaveAttribute('aria-disabled');

        fireEvent.click(tab(/Survey questions/));
        await waitFor(() => expect(screen.getByTestId('form-builder')).toBeInTheDocument());
        fireEvent.click(tab(EXPORT_TAB));
        await waitFor(() => expect(screen.getByTestId('export-panel')).toBeInTheDocument());
    });

    test('A link to the report tab unlocks the export tab', async () => {
        renderBuilder('?tab=report');
        await waitFor(() => expect(screen.getByTestId('report-panel')).toBeInTheDocument());
        expect(tab(EXPORT_TAB)).not.toHaveAttribute('aria-disabled');
    });

    test('A link to the export tab lands on the report tab first', async () => {
        renderBuilder('?tab=export');
        await waitFor(() => expect(screen.getByTestId('report-panel')).toBeInTheDocument());
        expect(screen.queryByTestId('export-panel')).not.toBeInTheDocument();
    });

    test('Next on the report tab opens the export tab once saved', async () => {
        renderBuilder('?tab=report');
        await waitFor(() => expect(screen.getByTestId('report-panel')).toBeInTheDocument());

        fireEvent.click(screen.getByText('Next: Public/Proponent export settings'));
        await waitFor(() => expect(screen.getByTestId('export-panel')).toBeInTheDocument());
    });

    test('A failed report save keeps the admin on the report tab', async () => {
        reportSave.mockResolvedValue(false);
        renderBuilder('?tab=report');
        await waitFor(() => expect(screen.getByTestId('report-panel')).toBeInTheDocument());

        fireEvent.click(screen.getByText('Next: Public/Proponent export settings'));
        fireEvent.click(tab(EXPORT_TAB));
        await waitFor(() => expect(reportSave).toHaveBeenCalledTimes(2));
        expect(screen.getByTestId('report-panel')).toBeInTheDocument();
        expect(screen.queryByTestId('export-panel')).not.toBeInTheDocument();
    });

    test('A failed export save keeps the admin on the export tab', async () => {
        renderBuilder('?tab=report');
        await waitFor(() => expect(screen.getByTestId('report-panel')).toBeInTheDocument());
        fireEvent.click(tab(EXPORT_TAB));
        await waitFor(() => expect(screen.getByTestId('export-panel')).toBeInTheDocument());

        exportSave.mockResolvedValue(false);
        fireEvent.click(screen.getByText('Go to Public report settings'));
        await waitFor(() => expect(exportSave).toHaveBeenCalledTimes(1));
        expect(screen.getByTestId('export-panel')).toBeInTheDocument();
    });

    test('The export tab link opens the report tab on that question', async () => {
        renderBuilder('?tab=report');
        await waitFor(() => expect(screen.getByTestId('report-panel')).toBeInTheDocument());
        fireEvent.click(tab(EXPORT_TAB));
        await waitFor(() => expect(screen.getByTestId('export-panel')).toBeInTheDocument());

        fireEvent.click(screen.getByText('Go to Public report settings'));
        await waitFor(() => expect(screen.getByTestId('report-panel')).toHaveAttribute('data-focus', 'key4'));
    });

    test('A locked survey browses every tab without saving anything', async () => {
        jest.spyOn(surveyService, 'getSurvey').mockResolvedValue({ ...survey, engagement_id: 7 } as Survey);
        jest.spyOn(engagementService, 'getEngagement').mockResolvedValue({
            id: 7,
            name: 'Engagement',
            status_id: EngagementStatus.Closed,
        } as unknown as Engagement);
        renderBuilder('?tab=report');
        await waitFor(() => expect(screen.getByTestId('report-panel')).toBeInTheDocument());

        fireEvent.click(tab(EXPORT_TAB));
        await waitFor(() => expect(screen.getByTestId('export-panel')).toBeInTheDocument());
        fireEvent.click(tab(/Survey questions/));
        await waitFor(() => expect(screen.getByTestId('form-builder')).toBeInTheDocument());

        expect(reportSave).not.toHaveBeenCalled();
        expect(exportSave).not.toHaveBeenCalled();
        expect(surveyService.putSurvey).not.toHaveBeenCalled();
    });

    test('Keyboard navigation skips the locked export tab', async () => {
        renderBuilder();
        await waitFor(() => expect(screen.getByTestId('form-builder')).toBeInTheDocument());

        fireEvent.keyDown(tab(/Survey questions/), { key: 'End' });
        await waitFor(() => expect(screen.getByTestId('report-panel')).toBeInTheDocument());
        expect(screen.queryByTestId('export-panel')).not.toBeInTheDocument();
    });
});

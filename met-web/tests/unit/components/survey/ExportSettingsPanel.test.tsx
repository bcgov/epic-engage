import React from 'react';
import { act, render, waitFor, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { setupEnv } from '../setEnvVars';
import * as reportSettingsService from 'services/surveyService/reportSettingsService';
import {
    ExportSettingsPanel,
    FREE_TEXT_PAGES_DISCLAIMER,
    HIDDEN_IN_REPORT_NOTICE,
} from 'components/admin/survey/building/ExportSettingsPanel';
import {
    CLOSED_ENGAGEMENT_TOOLTIP,
    ReportSettingsPanelHandle,
} from 'components/admin/survey/building/ReportSettingsPanel';
import { FormBuilderData } from 'components/shared/form/FormBuilder/types';
import { SurveyReportSetting } from 'models/surveyReportSetting';

jest.mock('axios');

jest.mock('hooks', () => ({
    ...jest.requireActual('hooks'),
    useAppDispatch: jest.fn(() => jest.fn()),
}));

const setting = (id: number, overrides: Partial<SurveyReportSetting> = {}): SurveyReportSetting => ({
    id,
    survey_id: 1,
    question_id: id,
    question_key: `key${id}`,
    question_type: 'simpletextarea',
    question: `question ${id}`,
    display: true,
    export_display: true,
    ...overrides,
});

const radio = setting(1, { question_type: 'simpleradios', question: 'Where do you live?' });
const otherFollowUp = setting(2, { question_type: 'simpletextfield', question: 'Please specify' });
const radioOnly = setting(3, { question_type: 'simpleradios', question: 'Radio only page' });
const hiddenInReport = setting(4, { display: false, export_display: true, question: 'Hidden comment' });
const describedComment = setting(5, { description: 'Report description', question: 'Final thoughts' });

const settings = [radio, otherFollowUp, radioOnly, hiddenInReport, describedComment];

const formDefinition: FormBuilderData = {
    display: 'wizard',
    components: [
        { title: 'Demographics', components: [{ id: '1' }, { id: '2' }] },
        { title: 'Choices', components: [{ id: '3' }] },
        { title: 'Final', components: [{ id: '4' }, { id: '5' }] },
    ],
};

const singlePage = (id: string): FormBuilderData => ({ display: 'form', components: [{ id, title: '' }] });

const conditionalLinks = {
    key2: {
        trigger_key: 'key1',
        row_key: null,
        row_label: null,
        trigger_values: ['other'],
        trigger_value_labels: ['Other'],
    },
};

const saveVia = async (ref: React.RefObject<ReportSettingsPanelHandle>) => {
    let saved: boolean | undefined;
    await act(async () => {
        saved = await ref.current?.save();
    });
    return saved;
};

const toggle = (id: number) => screen.getByTestId(`export-setting-toggle-${id}`).children[0];

describe('ExportSettingsPanel tests', () => {
    const fetchMock = jest.spyOn(reportSettingsService, 'fetchSurveyReportSettings');
    const updateMock = jest.spyOn(reportSettingsService, 'updateSurveyReportSettings');

    const renderPanel = (props: Partial<React.ComponentProps<typeof ExportSettingsPanel>> = {}) =>
        render(
            <ExportSettingsPanel
                surveyId="1"
                formDefinition={formDefinition}
                conditionalLinks={conditionalLinks}
                {...props}
            />,
        );

    const goToFinalPage = async () => {
        await waitFor(() => expect(screen.getByText('Please specify')).toBeVisible());
        fireEvent.click(screen.getByText('Next').closest('button') as HTMLButtonElement);
        await waitFor(() => expect(screen.getByText('Final thoughts')).toBeVisible());
    };

    beforeEach(() => {
        setupEnv();
        jest.clearAllMocks();
        fetchMock.mockReturnValue(Promise.resolve(settings));
        updateMock.mockReturnValue(Promise.resolve(settings));
    });

    test('Shows only free-text questions, on only the pages that have them', async () => {
        renderPanel();

        await waitFor(() => expect(screen.getByText('Please specify')).toBeVisible());
        expect(screen.getByText(FREE_TEXT_PAGES_DISCLAIMER)).toBeVisible();
        expect(screen.queryByText('Where do you live?')).not.toBeInTheDocument();
        expect(screen.getByText('Follow-up to: Where do you live?')).toBeVisible();
        expect(screen.getByText('Page 1 of 2')).toBeVisible();
        expect(screen.queryByText('Choices')).not.toBeInTheDocument();

        await goToFinalPage();
        expect(screen.queryByText('Radio only page')).not.toBeInTheDocument();
    });

    test('Shows the disclaimer on a single-page survey too', async () => {
        renderPanel({ formDefinition: singlePage('5') });

        await waitFor(() => expect(screen.getByText('Final thoughts')).toBeVisible());
        expect(screen.getByText(FREE_TEXT_PAGES_DISCLAIMER)).toBeVisible();
    });

    test('A question hidden in the public report is locked off, with a working link back', async () => {
        const onGoToReport = jest.fn();
        renderPanel({ onGoToReport });
        await goToFinalPage();

        const notice = screen.getByTestId(`export-setting-locked-${hiddenInReport.id}`);
        expect(within(notice).getByText(HIDDEN_IN_REPORT_NOTICE)).toBeVisible();
        expect(toggle(hiddenInReport.id)).not.toBeChecked();
        expect(toggle(hiddenInReport.id)).toBeDisabled();

        fireEvent.click(within(notice).getByRole('button', { name: 'Go to Public report settings' }));
        expect(onGoToReport).toHaveBeenCalledWith(hiddenInReport.question_key);
    });

    test.each([true, false])(
        'Showing a hidden question again restores its export preference (%s)',
        async (exportDisplay) => {
            fetchMock.mockReturnValue(
                Promise.resolve([{ ...hiddenInReport, display: true, export_display: exportDisplay }]),
            );
            renderPanel({ formDefinition: singlePage('4') });

            await waitFor(() => expect(screen.getByText('Hidden comment')).toBeVisible());
            expect(toggle(hiddenInReport.id)).toBeEnabled();
            if (exportDisplay) {
                expect(toggle(hiddenInReport.id)).toBeChecked();
            } else {
                expect(toggle(hiddenInReport.id)).not.toBeChecked();
            }
        },
    );

    test('Toggling and saving sends only the export fields', async () => {
        const onSaved = jest.fn();
        renderPanel({ onSaved });
        await waitFor(() => expect(screen.getByText('Please specify')).toBeVisible());

        fireEvent.click(toggle(otherFollowUp.id));
        fireEvent.click(screen.getByTestId('survey/export/save-button'));

        await waitFor(() =>
            expect(updateMock).toHaveBeenCalledWith('1', [{ id: otherFollowUp.id, export_display: false }]),
        );
        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    });

    test('An untouched description follows the report description and is not saved', async () => {
        renderPanel();
        await goToFinalPage();

        expect(screen.getByText('Report description')).toBeVisible();
        fireEvent.click(screen.getByTestId('survey/export/save-button'));
        await waitFor(() => expect(updateMock).not.toHaveBeenCalled());
    });

    const editDescription = (settingId: number, value: string) => {
        fireEvent.change(screen.getByTestId(`report-setting-description-input-${settingId}`), {
            target: { value },
        });
        fireEvent.click(screen.getByTestId(`report-setting-description-save-${settingId}`));
    };

    test('Explicitly saving the report text stops a description following the report', async () => {
        const ref = React.createRef<ReportSettingsPanelHandle>();
        render(<ExportSettingsPanel ref={ref} surveyId="1" formDefinition={singlePage('5')} />);
        await waitFor(() => expect(screen.getByText('Report description')).toBeVisible());

        fireEvent.click(screen.getByRole('button', { name: 'Edit description' }));
        editDescription(describedComment.id, 'Report description');
        await saveVia(ref);

        expect(updateMock).toHaveBeenCalledWith('1', [
            { id: describedComment.id, export_description: 'Report description' },
        ]);
    });

    test('Editing an override back to the report text saves it', async () => {
        fetchMock.mockReturnValue(Promise.resolve([{ ...describedComment, export_description: 'Export only' }]));
        const ref = React.createRef<ReportSettingsPanelHandle>();
        render(<ExportSettingsPanel ref={ref} surveyId="1" formDefinition={singlePage('5')} />);
        await waitFor(() => expect(screen.getByText('Export only')).toBeVisible());

        fireEvent.click(screen.getByRole('button', { name: 'Edit description' }));
        editDescription(describedComment.id, 'Report description');
        await saveVia(ref);

        expect(updateMock).toHaveBeenCalledWith('1', [
            { id: describedComment.id, export_description: 'Report description' },
        ]);
    });

    test('Clearing an override saves an empty description rather than inheriting', async () => {
        fetchMock.mockReturnValue(Promise.resolve([{ ...describedComment, export_description: 'Export only' }]));
        const ref = React.createRef<ReportSettingsPanelHandle>();
        render(<ExportSettingsPanel ref={ref} surveyId="1" formDefinition={singlePage('5')} />);
        await waitFor(() => expect(screen.getByText('Export only')).toBeVisible());

        fireEvent.click(screen.getByRole('button', { name: 'Edit description' }));
        editDescription(describedComment.id, '');
        await saveVia(ref);

        expect(updateMock).toHaveBeenCalledWith('1', [{ id: describedComment.id, export_description: '' }]);
    });

    test('A failed save reports false so the builder keeps the admin here', async () => {
        updateMock.mockImplementation(() => Promise.reject(new Error('save failed')));
        const ref = React.createRef<ReportSettingsPanelHandle>();
        render(
            <ExportSettingsPanel
                ref={ref}
                surveyId="1"
                formDefinition={formDefinition}
                conditionalLinks={conditionalLinks}
            />,
        );
        await waitFor(() => expect(screen.getByText('Please specify')).toBeVisible());

        fireEvent.click(toggle(otherFollowUp.id));
        expect(await saveVia(ref)).toBe(false);
        expect(toggle(otherFollowUp.id)).not.toBeChecked();
    });

    test('Read-only mode offers no way to change anything and saves nothing', async () => {
        const ref = React.createRef<ReportSettingsPanelHandle>();
        render(
            <ExportSettingsPanel
                ref={ref}
                surveyId="1"
                formDefinition={formDefinition}
                conditionalLinks={conditionalLinks}
                readOnly
            />,
        );
        await waitFor(() => expect(screen.getByText('Please specify')).toBeVisible());

        expect(toggle(otherFollowUp.id)).toBeDisabled();
        expect(screen.queryByText('Add description')).not.toBeInTheDocument();
        expect(screen.queryByTestId('survey/export/save-button')).not.toBeInTheDocument();
        expect(await saveVia(ref)).toBe(true);
        expect(updateMock).not.toHaveBeenCalled();
    });

    test('A closed engagement swaps each toggle for a locked statement of its inclusion', async () => {
        fetchMock.mockReturnValue(
            Promise.resolve([otherFollowUp, { ...describedComment, export_display: false }, hiddenInReport]),
        );
        renderPanel({
            formDefinition: {
                display: 'form',
                components: [
                    { id: '2', title: '' },
                    { id: '5', title: '' },
                    { id: '4', title: '' },
                ],
            },
            readOnly: true,
            engagementClosed: true,
        });

        await waitFor(() => expect(screen.getByText('Please specify')).toBeVisible());
        expect(screen.queryByTestId(`export-setting-toggle-${otherFollowUp.id}`)).not.toBeInTheDocument();
        expect(screen.getByTestId(`export-setting-closed-${otherFollowUp.id}`)).toHaveTextContent(
            'Shown in comment export',
        );
        expect(screen.getByTestId(`export-setting-closed-${describedComment.id}`)).toHaveTextContent(
            'Hidden from comment export',
        );
        // Hidden in the public report, so never exported whatever its own setting says.
        expect(screen.getByTestId(`export-setting-closed-${hiddenInReport.id}`)).toHaveTextContent(
            'Hidden from comment export',
        );

        fireEvent.mouseOver(screen.getAllByLabelText(CLOSED_ENGAGEMENT_TOOLTIP)[0]);
        expect(await screen.findByRole('tooltip')).toHaveTextContent(CLOSED_ENGAGEMENT_TOOLTIP);
    });

    test('A survey without free-text questions says so', async () => {
        fetchMock.mockReturnValue(Promise.resolve([radio]));
        renderPanel({ formDefinition: singlePage('1') });

        await waitFor(() => expect(screen.getByText(/no free-text questions/)).toBeVisible());
    });
});

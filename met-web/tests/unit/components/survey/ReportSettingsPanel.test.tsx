import React from 'react';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { setupEnv } from '../setEnvVars';
import * as reportSettingsService from 'services/surveyService/reportSettingsService';
import { ReportSettingsPanel } from 'components/admin/survey/building/ReportSettingsPanel';
import { FormBuilderData } from 'components/shared/form/FormBuilder/types';

jest.mock('axios');

jest.mock('hooks', () => ({
    ...jest.requireActual('hooks'),
    useAppDispatch: jest.fn(() => jest.fn()),
}));

const surveyReportSettingOne = {
    id: 1,
    survey_id: 1,
    question_id: 1,
    question_key: 'question key one',
    question_type: 'simpleradios',
    question: 'question one',
    display: true,
};

const surveyReportSettingTwo = {
    id: 2,
    survey_id: 1,
    question_id: 2,
    question_key: 'question key two',
    question_type: 'simpletextfield',
    question: 'question two',
    display: false,
};

const surveyReportSettings = [surveyReportSettingOne, surveyReportSettingTwo];

const formDefinition: FormBuilderData = {
    display: 'form',
    components: [
        { id: '1', title: 'question one' },
        { id: '2', title: 'question two' },
    ],
};

describe('ReportSettingsPanel tests', () => {
    const fetchSurveyReportSettingsMock = jest
        .spyOn(reportSettingsService, 'fetchSurveyReportSettings')
        .mockReturnValue(Promise.resolve(surveyReportSettings));
    const updateSurveyReportSettingsMock = jest
        .spyOn(reportSettingsService, 'updateSurveyReportSettings')
        .mockReturnValue(Promise.resolve(surveyReportSettings));

    beforeEach(() => {
        setupEnv();
        jest.clearAllMocks();
        fetchSurveyReportSettingsMock.mockReturnValue(Promise.resolve(surveyReportSettings));
        updateSurveyReportSettingsMock.mockReturnValue(Promise.resolve(surveyReportSettings));
    });

    test('Renders questions with their current visibility state', async () => {
        render(<ReportSettingsPanel surveyId="1" formDefinition={formDefinition} />);

        await waitFor(() => {
            expect(fetchSurveyReportSettingsMock).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingOne.question)).toBeVisible();
            expect(screen.getByText(surveyReportSettingTwo.question)).toBeVisible();
        });

        expect(screen.getByTestId(`report-setting-toggle-${surveyReportSettingOne.id}`).children[0]).toBeChecked();
        expect(screen.getByTestId(`report-setting-toggle-${surveyReportSettingTwo.id}`).children[0]).not.toBeChecked();
    });

    test('Toggling and saving sends only the changed settings', async () => {
        render(<ReportSettingsPanel surveyId="1" formDefinition={formDefinition} />);

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingTwo.question)).toBeVisible();
        });

        const toggle = screen.getByTestId(`report-setting-toggle-${surveyReportSettingTwo.id}`).children[0];
        expect(toggle).not.toBeChecked();

        fireEvent.click(toggle);
        await waitFor(() => {
            expect(toggle).toBeChecked();
        });

        fireEvent.click(screen.getByTestId('survey/report/save-button'));

        await waitFor(() => {
            expect(updateSurveyReportSettingsMock).toHaveBeenNthCalledWith(1, '1', [
                {
                    ...surveyReportSettingTwo,
                    display: true,
                },
            ]);
        });
    });

    test('Saving without any changes does not call the update endpoint', async () => {
        render(<ReportSettingsPanel surveyId="1" formDefinition={formDefinition} />);

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingOne.question)).toBeVisible();
        });

        fireEvent.click(screen.getByTestId('survey/report/save-button'));

        await waitFor(() => {
            expect(updateSurveyReportSettingsMock).not.toHaveBeenCalled();
        });
    });

    test('Saving leaves the builder once the settings are persisted', async () => {
        const onSaved = jest.fn();
        render(<ReportSettingsPanel surveyId="1" formDefinition={formDefinition} onSaved={onSaved} />);

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingTwo.question)).toBeVisible();
        });

        fireEvent.click(screen.getByTestId(`report-setting-toggle-${surveyReportSettingTwo.id}`).children[0]);
        fireEvent.click(screen.getByTestId('survey/report/save-button'));

        await waitFor(() => {
            expect(onSaved).toHaveBeenCalledTimes(1);
        });
    });

    test('Saving with nothing changed still leaves the builder', async () => {
        const onSaved = jest.fn();
        render(<ReportSettingsPanel surveyId="1" formDefinition={formDefinition} onSaved={onSaved} />);

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingOne.question)).toBeVisible();
        });

        fireEvent.click(screen.getByTestId('survey/report/save-button'));

        await waitFor(() => {
            expect(onSaved).toHaveBeenCalledTimes(1);
        });
        expect(updateSurveyReportSettingsMock).not.toHaveBeenCalled();
    });

    test('A failed save keeps the admin on the page', async () => {
        updateSurveyReportSettingsMock.mockImplementation(() => Promise.reject(new Error('save failed')));
        const onSaved = jest.fn();
        render(<ReportSettingsPanel surveyId="1" formDefinition={formDefinition} onSaved={onSaved} />);

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingTwo.question)).toBeVisible();
        });

        fireEvent.click(screen.getByTestId(`report-setting-toggle-${surveyReportSettingTwo.id}`).children[0]);
        fireEvent.click(screen.getByTestId('survey/report/save-button'));

        await waitFor(() => {
            expect(updateSurveyReportSettingsMock).toHaveBeenCalledTimes(1);
        });
        expect(onSaved).not.toHaveBeenCalled();
    });

    test('Cancel leaves the builder without saving', async () => {
        const onCancel = jest.fn();
        render(<ReportSettingsPanel surveyId="1" formDefinition={formDefinition} onCancel={onCancel} />);

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingOne.question)).toBeVisible();
        });

        fireEvent.click(screen.getByTestId(`report-setting-toggle-${surveyReportSettingOne.id}`).children[0]);
        fireEvent.click(screen.getByTestId('survey/report/cancel-button'));

        await waitFor(() => {
            expect(onCancel).toHaveBeenCalledTimes(1);
        });
        expect(updateSurveyReportSettingsMock).not.toHaveBeenCalled();
    });

    test('Shows a no-responses placeholder for charts when the survey has no engagement', async () => {
        render(<ReportSettingsPanel surveyId="1" formDefinition={formDefinition} />);

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingOne.question)).toBeVisible();
        });

        expect(screen.getAllByText(/Results will appear here/i).length).toBeGreaterThan(0);
    });

    test('Adding a description includes it in the saved settings payload', async () => {
        render(<ReportSettingsPanel surveyId="1" formDefinition={formDefinition} />);

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingOne.question)).toBeVisible();
        });

        fireEvent.click(screen.getAllByText('Add description')[0]);

        const input = screen.getByTestId(`report-setting-description-input-${surveyReportSettingOne.id}`);
        fireEvent.change(input, { target: { value: 'Extra context for admins' } });
        fireEvent.click(screen.getByTestId(`report-setting-description-save-${surveyReportSettingOne.id}`));

        fireEvent.click(screen.getByTestId('survey/report/save-button'));

        await waitFor(() => {
            expect(updateSurveyReportSettingsMock).toHaveBeenNthCalledWith(1, '1', [
                {
                    ...surveyReportSettingOne,
                    display: true,
                    description: 'Extra context for admins',
                },
            ]);
        });
    });

    test('Nests a conditional follow-up under its trigger using the links it is given', async () => {
        // Question two is only shown when question one is answered "other".
        render(
            <ReportSettingsPanel
                surveyId="1"
                formDefinition={formDefinition}
                conditionalLinks={{
                    [surveyReportSettingTwo.question_key]: {
                        trigger_key: surveyReportSettingOne.question_key,
                        trigger_label: surveyReportSettingOne.question,
                        row_key: null,
                        row_label: null,
                        trigger_values: ['other'],
                        trigger_value_labels: ['Other'],
                    },
                }}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingTwo.question)).toBeVisible();
        });

        // The follow-up renders inside its trigger's block, labelled with the condition, rather
        // than as a top-level question of its own.
        const followUp = screen.getByText(surveyReportSettingTwo.question);
        const trigger = screen.getByText(surveyReportSettingOne.question);
        expect(trigger.closest('.MuiPaper-root')).toContainElement(followUp);
        expect(screen.getByText(/Other/)).toBeVisible();
    });

    test('Read-only mode shows the settings but offers no way to change them', async () => {
        render(<ReportSettingsPanel surveyId="1" formDefinition={formDefinition} readOnly />);

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingOne.question)).toBeVisible();
            expect(screen.getByText(surveyReportSettingTwo.question)).toBeVisible();
        });

        expect(screen.getByTestId(`report-setting-toggle-${surveyReportSettingOne.id}`).children[0]).toBeDisabled();
        expect(screen.queryByTestId('survey/report/save-button')).not.toBeInTheDocument();
        expect(screen.queryByText('Add description')).not.toBeInTheDocument();
    });

    test('A question toggled off greys out its description controls until it is toggled back on', async () => {
        fetchSurveyReportSettingsMock.mockReturnValue(
            Promise.resolve([
                surveyReportSettingOne,
                { ...surveyReportSettingTwo, description: 'Context for question two' },
            ]),
        );

        render(<ReportSettingsPanel surveyId="1" formDefinition={formDefinition} />);

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingTwo.question)).toBeVisible();
        });

        expect(screen.getByText('Context for question two')).toBeVisible();
        const editButton = screen.getByLabelText('Edit description');
        expect(editButton).toBeVisible();
        expect(editButton).toBeDisabled();
        expect(screen.getByRole('button', { name: /Add description/ })).toBeEnabled();

        fireEvent.click(editButton);
        expect(
            screen.queryByTestId(`report-setting-description-input-${surveyReportSettingTwo.id}`),
        ).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId(`report-setting-toggle-${surveyReportSettingTwo.id}`).children[0]);

        await waitFor(() => {
            expect(screen.getByLabelText('Edit description')).toBeEnabled();
        });
    });

    test('Everything inside a toggled-off question is hidden from the keyboard and screen readers', async () => {
        render(<ReportSettingsPanel surveyId="1" formDefinition={formDefinition} />);

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingTwo.question)).toBeVisible();
        });

        const hiddenQuestion = screen.getByText(surveyReportSettingTwo.question);
        expect(hiddenQuestion.closest('[inert]')).not.toBeNull();
        expect(screen.getByTestId(`report-setting-toggle-${surveyReportSettingTwo.id}`).closest('[inert]')).toBeNull();
        expect(screen.getByText(surveyReportSettingOne.question).closest('[inert]')).toBeNull();
    });

    test('Toggling a question off while editing its description drops the editor', async () => {
        render(<ReportSettingsPanel surveyId="1" formDefinition={formDefinition} />);

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingOne.question)).toBeVisible();
        });

        fireEvent.click(screen.getAllByText('Add description')[0]);
        const input = screen.getByTestId(`report-setting-description-input-${surveyReportSettingOne.id}`);
        fireEvent.change(input, { target: { value: 'Draft that should not be savable' } });

        fireEvent.click(screen.getByTestId(`report-setting-toggle-${surveyReportSettingOne.id}`).children[0]);

        await waitFor(() => {
            expect(
                screen.queryByTestId(`report-setting-description-input-${surveyReportSettingOne.id}`),
            ).not.toBeInTheDocument();
        });
        expect(
            screen.queryByTestId(`report-setting-description-save-${surveyReportSettingOne.id}`),
        ).not.toBeInTheDocument();
        expect(screen.getAllByText('Cancel')).toHaveLength(1);
        expect(screen.getAllByRole('button', { name: /Add description/ })[0]).toBeDisabled();

        fireEvent.click(screen.getByTestId('survey/report/save-button'));

        await waitFor(() => {
            expect(updateSurveyReportSettingsMock).toHaveBeenNthCalledWith(1, '1', [
                { ...surveyReportSettingOne, display: false },
            ]);
        });
    });

    test('Paginates between survey pages with the previous/next footer', async () => {
        const multiPageFormDefinition: FormBuilderData = {
            display: 'wizard',
            components: [
                { id: 'page-1', title: 'Page 1', components: [{ id: '1', title: 'question one' }] },
                { id: 'page-2', title: 'Page 2', components: [{ id: '2', title: 'question two' }] },
            ],
        };

        render(<ReportSettingsPanel surveyId="1" formDefinition={multiPageFormDefinition} />);

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingOne.question)).toBeVisible();
        });
        expect(screen.queryByText(surveyReportSettingTwo.question)).not.toBeInTheDocument();
        expect(screen.getByText('Page 1 of 2')).toBeVisible();
        expect(screen.getByText('Previous').closest('button')).toBeDisabled();

        fireEvent.click(screen.getByText('Next').closest('button') as HTMLButtonElement);

        await waitFor(() => {
            expect(screen.getByText(surveyReportSettingTwo.question)).toBeVisible();
        });
        expect(screen.queryByText(surveyReportSettingOne.question)).not.toBeInTheDocument();
        expect(screen.getByText('Page 2 of 2')).toBeVisible();
        expect(screen.getByText('Next').closest('button')).toBeDisabled();
    });
});

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Box, Skeleton, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useAppDispatch } from 'hooks';
import { openNotification } from 'services/notificationService/notificationSlice';
import { fetchSurveyReportSettings, updateSurveyReportSettings } from 'services/surveyService/reportSettingsService';
import { SurveyReportSetting } from 'models/surveyReportSetting';
import { FormBuilderData } from 'components/shared/form/FormBuilder/types';
import { MetDescription, MetIconText, MetPaper, PrimaryButton, SecondaryButton } from 'components/shared/common';
import { QuestionTypeLabel } from 'components/public/dashboard/charts/QuestionTypeLabel';
import { Comments } from 'components/public/dashboard/charts';
import {
    TYPE_LABELS as QUESTION_TYPE_LABELS,
    QuestionChart,
    toFlatItems,
    describeConditional,
} from 'components/public/dashboard/SurveyResultsCharts';
import { useSurveyResultPages } from 'components/public/dashboard/hooks/useSurveyResultPages';
import { useSurveyComments } from 'components/public/dashboard/hooks/useSurveyComments';
import { DashboardType } from 'constants/dashboardType';
import FormStepper from 'components/public/survey/submit/Stepper';
import { SurveySwitch } from './AdditionalSettings';
import { groupReportSettingsByPage } from './groupReportSettingsByPage';
import { DescriptionEditor } from './DescriptionEditor';

export interface ReportSettingsPanelProps {
    surveyId: string;
    // Undefined for a survey not yet attached to an engagement - chart data is skipped and every
    // question falls back to the "No responses yet" placeholder.
    engagementId?: number;
    formDefinition: FormBuilderData;
}

// Exposes an imperative save() so the builder page can flush unsaved toggle
// changes when the admin switches away to the Survey questions tab.
export interface ReportSettingsPanelHandle {
    save: () => Promise<void>;
}

export const ReportSettingsPanel = forwardRef<ReportSettingsPanelHandle, ReportSettingsPanelProps>(
    ({ surveyId, engagementId, formDefinition }, ref) => {
        const dispatch = useAppDispatch();
        const [settings, setSettings] = useState<SurveyReportSetting[]>([]);
        const [displayedMap, setDisplayedMap] = useState<Record<number, boolean>>({});
        const [descriptionMap, setDescriptionMap] = useState<Record<number, string>>({});
        const [loading, setLoading] = useState(true);
        const [saving, setSaving] = useState(false);
        const [currentPage, setCurrentPage] = useState(0);

        useEffect(() => {
            loadSettings();
        }, [surveyId]);

        const loadSettings = async () => {
            if (!surveyId || isNaN(Number(surveyId))) {
                setLoading(false);
                return;
            }
            try {
                setLoading(true);
                const loadedSettings = await fetchSurveyReportSettings(surveyId);
                setSettings(loadedSettings);
                setDisplayedMap(
                    loadedSettings.reduce(
                        (acc, setting) => ({ ...acc, [setting.id]: setting.display }),
                        {} as Record<number, boolean>,
                    ),
                );
                setDescriptionMap(
                    loadedSettings.reduce(
                        (acc, setting) => ({ ...acc, [setting.id]: setting.description ?? '' }),
                        {} as Record<number, string>,
                    ),
                );
            } catch (error) {
                dispatch(
                    openNotification({ severity: 'error', text: 'Error occurred while loading report settings.' }),
                );
            } finally {
                setLoading(false);
            }
        };

        const {
            data: resultData,
            conditionalLinks,
            isLoading: resultLoading,
        } = useSurveyResultPages(engagementId, Number(surveyId), DashboardType.INTERNAL);
        const { data: commentsData, isLoading: commentsLoading } = useSurveyComments(
            engagementId,
            Number(surveyId),
            DashboardType.INTERNAL,
        );
        // These hooks stay "loading" forever with no engagementId, so only treat that as a
        // loading state when there's actually a fetch in flight.
        const chartsLoading = Boolean(engagementId) && (resultLoading || commentsLoading);

        const chartDataByKey = useMemo(
            () => new Map((resultData?.data ?? []).map((question) => [question.key, question])),
            [resultData],
        );
        const commentQuestionsByKey = useMemo(
            () => new Map((commentsData?.data ?? []).map((question) => [question.key, question])),
            [commentsData],
        );
        const commentsByKey = useMemo(
            () =>
                new Map(
                    (commentsData?.data ?? []).map((question) => [
                        question.key,
                        toFlatItems(question.result).map((r) => r.value),
                    ]),
                ),
            [commentsData],
        );

        const pages = useMemo(
            () => groupReportSettingsByPage(formDefinition, settings, conditionalLinks),
            [formDefinition, settings, conditionalLinks],
        );
        const safePage = Math.min(currentPage, Math.max(pages.length - 1, 0));

        const handleDescriptionSave = (settingId: number, description: string) => {
            setDescriptionMap((prev) => ({ ...prev, [settingId]: description }));
        };

        const handleSave = async () => {
            const changedSettings: SurveyReportSetting[] = [];
            settings.forEach((setting) => {
                const displayChanged = displayedMap[setting.id] !== setting.display;
                const nextDescription = descriptionMap[setting.id] ?? '';
                const originalDescription = setting.description ?? '';
                const descriptionChanged = nextDescription !== originalDescription;
                if (!displayChanged && !descriptionChanged) {
                    return;
                }
                changedSettings.push({
                    ...setting,
                    display: displayedMap[setting.id],
                    ...(descriptionChanged ? { description: nextDescription || null } : {}),
                });
            });

            if (!changedSettings.length) {
                return;
            }

            try {
                setSaving(true);
                await updateSurveyReportSettings(surveyId, changedSettings);
                const changedById = new Map(changedSettings.map((setting) => [setting.id, setting]));
                setSettings(settings.map((setting) => changedById.get(setting.id) ?? setting));
                dispatch(openNotification({ severity: 'success', text: 'Report settings saved successfully.' }));
            } catch (error) {
                dispatch(openNotification({ severity: 'error', text: 'Error occurred while saving report settings.' }));
            } finally {
                setSaving(false);
            }
        };

        useImperativeHandle(ref, () => ({ save: handleSave }));

        if (loading) {
            return (
                <Stack spacing={2} sx={{ pt: 2 }}>
                    <Skeleton variant="rounded" height={48} />
                    <Skeleton variant="rounded" height={120} />
                    <Skeleton variant="rounded" height={120} />
                </Stack>
            );
        }

        if (!settings.length) {
            return (
                <Typography sx={{ pt: 2 }}>
                    Add questions to the survey to configure what appears in the public report.
                </Typography>
            );
        }

        const renderVisibilityToggle = (setting: SurveyReportSetting) => (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0, pt: '2px' }}>
                <Typography sx={{ fontSize: '12px', color: '#474543', whiteSpace: 'nowrap' }}>
                    Show in public report
                </Typography>
                <SurveySwitch
                    data-testid={`report-setting-toggle-${setting.id}`}
                    checked={Boolean(displayedMap[setting.id])}
                    onChange={(event) => setDisplayedMap({ ...displayedMap, [setting.id]: event.target.checked })}
                    inputProps={{ 'aria-label': `Show "${setting.question}" in public report` }}
                />
            </Stack>
        );

        const renderChartBody = (setting: SurveyReportSetting) => {
            const chartQuestion =
                chartDataByKey.get(setting.question_key) ?? commentQuestionsByKey.get(setting.question_key);

            if (!chartQuestion) {
                if (chartsLoading) {
                    return <Skeleton variant="rounded" height={100} sx={{ mt: 1 }} />;
                }
                return (
                    <MetDescription sx={{ mt: 1, color: '#474543', fontStyle: 'italic' }}>
                        Results will appear here once the survey receives submissions.
                    </MetDescription>
                );
            }

            return (
                <Box sx={{ mt: 1 }}>
                    <QuestionChart
                        question={chartQuestion}
                        commentsByKey={commentsByKey}
                        followUps={[]}
                        dashboardType={DashboardType.INTERNAL}
                        bare
                    />
                </Box>
            );
        };

        const renderFollowUp = (followUpSetting: SurveyReportSetting, triggerType: string) => {
            const link = conditionalLinks[followUpSetting.question_key];
            const responses = commentsByKey.get(followUpSetting.question_key) ?? [];

            return (
                <Box key={followUpSetting.id} sx={{ mt: 2, pt: 2, borderTop: '2px dashed #D8D8D8' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1.5 }}>
                                <Box
                                    sx={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: '50%',
                                        backgroundColor: '#72B09D',
                                        flexShrink: 0,
                                    }}
                                />
                                <MetIconText
                                    sx={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        letterSpacing: '0.05em',
                                        textTransform: 'uppercase',
                                        color: '#474543',
                                    }}
                                >
                                    {link ? describeConditional(link, triggerType) : 'Conditional question'}
                                </MetIconText>
                            </Stack>
                            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#2D2D2D' }}>
                                {followUpSetting.question}
                            </Typography>
                            <DescriptionEditor
                                settingId={followUpSetting.id}
                                description={descriptionMap[followUpSetting.id] ?? ''}
                                onSave={handleDescriptionSave}
                            />
                        </Box>
                        {renderVisibilityToggle(followUpSetting)}
                    </Stack>
                    <Box sx={{ mt: 1.5 }}>
                        <Comments question={followUpSetting.question} responses={responses} bare />
                    </Box>
                </Box>
            );
        };

        return (
            <Box sx={{ pt: 2 }}>
                {pages.length > 1 && (
                    <FormStepper currentPage={safePage} pages={pages} onStepClick={(index) => setCurrentPage(index)} />
                )}
                <Stack spacing={2}>
                    {pages[safePage]?.items.map(({ setting, followUps }) => (
                        <MetPaper key={setting.id} sx={{ p: 3 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <QuestionTypeLabel
                                        label={QUESTION_TYPE_LABELS[setting.question_type] ?? setting.question_type}
                                    />
                                    <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#2D2D2D' }}>
                                        {setting.question}
                                    </Typography>
                                    <DescriptionEditor
                                        settingId={setting.id}
                                        description={descriptionMap[setting.id] ?? ''}
                                        onSave={handleDescriptionSave}
                                    />
                                </Box>
                                {renderVisibilityToggle(setting)}
                            </Stack>
                            {renderChartBody(setting)}
                            {followUps.map((followUpSetting) => renderFollowUp(followUpSetting, setting.question_type))}
                        </MetPaper>
                    ))}
                </Stack>
                {pages.length > 1 && (
                    <Box sx={{ pt: 1 }}>
                        <MetDescription sx={{ pt: 1.5, mb: 1.5, width: 'fit-content', borderTop: '1px solid #D8D8D8' }}>
                            Page {safePage + 1} of {pages.length}
                        </MetDescription>
                        <Stack direction="row" justifyContent="space-between" sx={{ width: '100%' }}>
                            <SecondaryButton
                                startIcon={<ArrowBackIcon />}
                                disabled={safePage === 0}
                                onClick={() => setCurrentPage(safePage - 1)}
                            >
                                Previous
                            </SecondaryButton>
                            <PrimaryButton
                                endIcon={<ArrowForwardIcon />}
                                disabled={safePage === pages.length - 1}
                                onClick={() => setCurrentPage(safePage + 1)}
                            >
                                Next
                            </PrimaryButton>
                        </Stack>
                    </Box>
                )}
                <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                    <PrimaryButton data-testid="survey/report/save-button" onClick={handleSave} loading={saving}>
                        Save
                    </PrimaryButton>
                </Stack>
            </Box>
        );
    },
);

ReportSettingsPanel.displayName = 'ReportSettingsPanel';

export default ReportSettingsPanel;

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Box, Link, Skeleton, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import { useAppDispatch } from 'hooks';
import { openNotification } from 'services/notificationService/notificationSlice';
import { fetchSurveyReportSettings, updateSurveyReportSettings } from 'services/surveyService/reportSettingsService';
import { SurveyReportSetting, SurveyReportSettingUpdate } from 'models/surveyReportSetting';
import { FormBuilderData } from 'components/shared/form/FormBuilder/types';
import { MetDescription, MetIconText, MetPaper, PrimaryButton, SecondaryButton } from 'components/shared/common';
import { QuestionTypeLabel } from 'components/public/dashboard/charts/QuestionTypeLabel';
import { Comments } from 'components/public/dashboard/charts';
import {
    TYPE_LABELS as QUESTION_TYPE_LABELS,
    toFlatItems,
    describeConditional,
} from 'components/public/dashboard/SurveyResultsCharts';
import { ConditionalLink } from 'components/public/dashboard/surveyPages';
import { useSurveyComments } from 'components/public/dashboard/hooks/useSurveyComments';
import { DashboardType } from 'constants/dashboardType';
import FormStepper from 'components/public/survey/submit/Stepper';
import { SurveySwitch } from './AdditionalSettings';
import { groupFreeTextSettingsByPage } from './groupReportSettingsByPage';
import { DescriptionEditor } from './DescriptionEditor';
import {
    ClosedEngagementVisibility,
    ReportSettingsPanelHandle,
    contentSx,
    dimmedSx,
    footerSx,
    inertProps,
} from './ReportSettingsPanel';
import { Palette } from 'styles/Theme';

export const FREE_TEXT_PAGES_DISCLAIMER = 'Only the pages with free-text questions are shown.';
export const HIDDEN_IN_REPORT_NOTICE =
    'Comments hidden in the public report are not included in this export. To include this comment, toggle it in the Public report settings first.';

export interface ExportSettingsPanelProps {
    surveyId: string;
    // Undefined for a survey not yet attached to an engagement - no responses to preview.
    engagementId?: number;
    formDefinition: FormBuilderData;
    conditionalLinks?: Record<string, ConditionalLink>;
    // Opens the Public report settings tab on the given question.
    onGoToReport?: (questionKey: string) => void;
    onSaved?: () => void;
    onCancel?: () => void;
    readOnly?: boolean;
    engagementClosed?: boolean;
}

// The description shown before anything is edited here: the export's own, else the report's.
const effectiveDescription = (setting: SurveyReportSetting) => setting.export_description ?? setting.description ?? '';

// Settings for the Public/Proponent comment export: which free-text questions it carries and the
// description shown with each. A question hidden in the public report is never exported, so its
// toggle is locked off here - its stored export preference is kept for when it's shown again.
export const ExportSettingsPanel = forwardRef<ReportSettingsPanelHandle, ExportSettingsPanelProps>(
    (
        {
            surveyId,
            engagementId,
            formDefinition,
            conditionalLinks = {},
            onGoToReport,
            onSaved,
            onCancel,
            readOnly = false,
            engagementClosed = false,
        },
        ref,
    ) => {
        const dispatch = useAppDispatch();
        const [settings, setSettings] = useState<SurveyReportSetting[]>([]);
        const [exportDisplayMap, setExportDisplayMap] = useState<Record<number, boolean>>({});
        const [descriptionMap, setDescriptionMap] = useState<Record<number, string>>({});
        // Descriptions saved in this tab. Saving one - even with the report's text unchanged -
        // stops it following the report description.
        const [editedDescriptionIds, setEditedDescriptionIds] = useState<Set<number>>(new Set());
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
                setExportDisplayMap(
                    Object.fromEntries(loadedSettings.map((setting) => [setting.id, setting.export_display])),
                );
                setDescriptionMap(
                    Object.fromEntries(loadedSettings.map((setting) => [setting.id, effectiveDescription(setting)])),
                );
                setEditedDescriptionIds(new Set());
            } catch (error) {
                dispatch(
                    openNotification({ severity: 'error', text: 'Error occurred while loading export settings.' }),
                );
            } finally {
                setLoading(false);
            }
        };

        const { data: commentsData, isLoading: commentsLoading } = useSurveyComments(
            engagementId,
            Number(surveyId),
            DashboardType.INTERNAL,
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
            () => groupFreeTextSettingsByPage(formDefinition, settings, conditionalLinks),
            [formDefinition, settings, conditionalLinks],
        );
        const safePage = Math.min(currentPage, Math.max(pages.length - 1, 0));

        const handleDescriptionSave = (settingId: number, description: string) => {
            setDescriptionMap((prev) => ({ ...prev, [settingId]: description }));
            setEditedDescriptionIds((prev) => new Set(prev).add(settingId));
        };

        const handleSave = async (): Promise<boolean> => {
            if (readOnly) {
                return true;
            }

            const changedSettings: SurveyReportSettingUpdate[] = [];
            settings.forEach((setting) => {
                const change: SurveyReportSettingUpdate = { id: setting.id };
                if (exportDisplayMap[setting.id] !== setting.export_display) {
                    change.export_display = exportDisplayMap[setting.id];
                }
                const description = descriptionMap[setting.id] ?? '';
                // An empty description is kept as '' so it doesn't fall back to the report's.
                if (
                    editedDescriptionIds.has(setting.id) &&
                    (setting.export_description == null || description !== setting.export_description)
                ) {
                    change.export_description = description;
                }
                if (Object.keys(change).length > 1) {
                    changedSettings.push(change);
                }
            });

            if (!changedSettings.length) {
                return true;
            }

            try {
                setSaving(true);
                await updateSurveyReportSettings(surveyId, changedSettings);
                const changedById = new Map(changedSettings.map((change) => [change.id, change]));
                setSettings(settings.map((setting) => ({ ...setting, ...changedById.get(setting.id) })));
                setEditedDescriptionIds(new Set());
                dispatch(openNotification({ severity: 'success', text: 'Export settings saved successfully.' }));
                return true;
            } catch (error) {
                dispatch(openNotification({ severity: 'error', text: 'Error occurred while saving export settings.' }));
                return false;
            } finally {
                setSaving(false);
            }
        };

        const handleSaveAndExit = async () => {
            if (await handleSave()) {
                onSaved?.();
            }
        };

        useImperativeHandle(ref, () => ({ save: handleSave }));

        if (loading) {
            return (
                <Stack spacing={2} sx={contentSx}>
                    <Skeleton variant="rounded" height={48} />
                    <Skeleton variant="rounded" height={120} />
                    <Skeleton variant="rounded" height={120} />
                </Stack>
            );
        }

        const renderCard = (setting: SurveyReportSetting, trigger?: SurveyReportSetting) => {
            const locked = !setting.display;
            const link = conditionalLinks[setting.question_key];
            const responses = commentsByKey.get(setting.question_key) ?? [];

            return (
                <MetPaper key={setting.id} sx={{ p: 3, ...(locked && { borderStyle: 'dashed' }) }}>
                    {locked && (
                        <Stack
                            data-testid={`export-setting-locked-${setting.id}`}
                            direction="row"
                            alignItems="flex-start"
                            gap={1}
                            sx={{
                                mb: 2,
                                p: 1.5,
                                borderRadius: '4px',
                                backgroundColor: Palette.background.light,
                                border: `1px solid ${Palette.border.default}`,
                            }}
                        >
                            <LockOutlinedIcon sx={{ fontSize: 16, mt: '2px', color: Palette.text.secondary }} />
                            <Box>
                                <Typography sx={{ fontSize: '13px', color: Palette.text.secondary }}>
                                    {HIDDEN_IN_REPORT_NOTICE}
                                </Typography>
                                <Link
                                    component="button"
                                    type="button"
                                    onClick={() => onGoToReport?.(setting.question_key)}
                                    sx={{ fontSize: '13px', mt: 0.5 }}
                                >
                                    Go to Public report settings
                                </Link>
                            </Box>
                        </Stack>
                    )}
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                        <Box {...inertProps(locked)} sx={{ flex: 1, minWidth: 0, ...dimmedSx(locked) }}>
                            {trigger ? (
                                <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1 }}>
                                    <Box
                                        sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: '50%',
                                            backgroundColor: Palette.chart.conditionalMarker,
                                            flexShrink: 0,
                                        }}
                                    />
                                    <MetIconText
                                        sx={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            letterSpacing: '0.05em',
                                            textTransform: 'uppercase',
                                            color: Palette.text.secondary,
                                        }}
                                    >
                                        {link
                                            ? describeConditional(link, trigger.question_type)
                                            : 'Conditional question'}
                                    </MetIconText>
                                </Stack>
                            ) : (
                                <QuestionTypeLabel
                                    label={QUESTION_TYPE_LABELS[setting.question_type] ?? setting.question_type}
                                />
                            )}
                            <Typography sx={{ fontSize: '16px', fontWeight: 700, color: Palette.text.primary }}>
                                {setting.question}
                            </Typography>
                            {trigger && (
                                <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
                                    <SubdirectoryArrowRightIcon sx={{ fontSize: 14, color: Palette.text.secondary }} />
                                    <Typography sx={{ fontSize: '12px', color: Palette.text.secondary }}>
                                        Follow-up to: {trigger.question}
                                    </Typography>
                                </Stack>
                            )}
                            <DescriptionEditor
                                settingId={setting.id}
                                description={descriptionMap[setting.id] ?? ''}
                                onSave={handleDescriptionSave}
                                readOnly={readOnly}
                                disabled={locked}
                            />
                        </Box>
                        {engagementClosed ? (
                            <ClosedEngagementVisibility
                                testId={`export-setting-closed-${setting.id}`}
                                text={
                                    !locked && exportDisplayMap[setting.id]
                                        ? 'Shown in comment export'
                                        : 'Hidden from comment export'
                                }
                            />
                        ) : (
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0, pt: '2px' }}>
                                <Typography
                                    sx={{ fontSize: '12px', color: Palette.text.secondary, whiteSpace: 'nowrap' }}
                                >
                                    Show in comment export
                                </Typography>
                                <SurveySwitch
                                    data-testid={`export-setting-toggle-${setting.id}`}
                                    checked={!locked && Boolean(exportDisplayMap[setting.id])}
                                    disabled={readOnly || locked}
                                    onChange={(event) =>
                                        setExportDisplayMap({ ...exportDisplayMap, [setting.id]: event.target.checked })
                                    }
                                    inputProps={{ 'aria-label': `Show "${setting.question}" in comment export` }}
                                />
                            </Stack>
                        )}
                    </Stack>
                    <Box {...inertProps(locked)} sx={{ mt: 1.5, ...dimmedSx(locked) }}>
                        {commentsLoading && engagementId ? (
                            <Skeleton variant="rounded" height={60} />
                        ) : (
                            <Comments question={setting.question} responses={responses} bare />
                        )}
                    </Box>
                </MetPaper>
            );
        };

        return (
            <>
                <Box sx={contentSx}>
                    {pages.length ? (
                        <>
                            {pages.length > 1 && (
                                <FormStepper
                                    currentPage={safePage}
                                    pages={pages}
                                    onStepClick={(index) => setCurrentPage(index)}
                                />
                            )}
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="center"
                                gap={0.75}
                                sx={{ mb: 2, color: Palette.text.secondary }}
                            >
                                <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                                <Typography sx={{ fontSize: '13px' }}>{FREE_TEXT_PAGES_DISCLAIMER}</Typography>
                            </Stack>
                            <Stack spacing={2}>
                                {pages[safePage].items.map(({ setting, trigger }) => renderCard(setting, trigger))}
                            </Stack>
                            {pages.length > 1 && (
                                <Box sx={{ pt: 1 }}>
                                    <MetDescription
                                        sx={{
                                            pt: 1.5,
                                            mb: 1.5,
                                            width: 'fit-content',
                                            borderTop: `1px solid ${Palette.border.default}`,
                                        }}
                                    >
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
                        </>
                    ) : (
                        <Typography>
                            This survey has no free-text questions, so there is nothing to include in the comment
                            export.
                        </Typography>
                    )}
                </Box>
                <Box sx={footerSx}>
                    <SecondaryButton data-testid="survey/export/cancel-button" onClick={() => onCancel?.()}>
                        {readOnly ? 'Close' : 'Cancel'}
                    </SecondaryButton>
                    {!readOnly && (
                        <PrimaryButton
                            data-testid="survey/export/save-button"
                            onClick={handleSaveAndExit}
                            loading={saving}
                        >
                            Save
                        </PrimaryButton>
                    )}
                </Box>
            </>
        );
    },
);

ExportSettingsPanel.displayName = 'ExportSettingsPanel';

export default ExportSettingsPanel;

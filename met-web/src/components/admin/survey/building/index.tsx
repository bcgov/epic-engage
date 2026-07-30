import { useEffect, useMemo, useRef, useState } from 'react';
import { Stack, Divider, TextField, IconButton, FormGroup, FormControlLabel, Box } from '@mui/material';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import FormBuilder from 'components/shared/form/FormBuilder';
import BorderColorIcon from '@mui/icons-material/BorderColor';
import ClearIcon from '@mui/icons-material/Clear';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { SurveyParams } from '../types';
import { getSurvey, putSurvey } from 'services/surveyService';
import { Survey } from 'models/survey';
import { useAppDispatch } from 'hooks';
import { openNotification } from 'services/notificationService/notificationSlice';
import { MetHeader3, PrimaryButton, SecondaryButton } from 'components/shared/common';
import { Breadcrumb } from 'components/public/dashboard/Breadcrumb';
import FormBuilderSkeleton from './FormBuilderSkeleton';
import { FormBuilderData } from 'components/shared/form/FormBuilder/types';
import { EngagementStatus } from 'constants/engagementStatus';
import { getEngagement } from 'services/engagementService';
import { Engagement } from 'models/engagement';
import { openNotificationModal } from 'services/notificationModalService/notificationModalSlice';
import axios from 'axios';
import { AutoSaveSnackBar } from './AutoSaveSnackBar';
import { AdditionalSettings, SurveySwitch } from './AdditionalSettings';
import { BuilderTabs, tabIds } from './BuilderTabs';
import { ReportSettingsPanel, ReportSettingsPanelHandle } from './ReportSettingsPanel';
import { debounce } from 'lodash';
import { format } from 'date-fns';

const TAB_QUESTIONS = 'questions';
const TAB_REPORT = 'report';

// Formio's builder grid gets its layout from Bootstrap 5 (formio-bootstrap.scss), not MUI's
// theme, so this uses Bootstrap's breakpoint (576px) rather than MUI's xs/sm (600px). Below it,
// formcomponents/formarea stack instead of sitting side by side, so there's nothing to align to.
const FORMIO_BREAKPOINT_SM = '@media (min-width:576px)';
const FORMAREA_LEFT = '220px';

interface SurveyForm {
    id: string;
    form_json: unknown;
    name: string;
    is_hidden: boolean;
    is_template: boolean;
}

const SurveyFormBuilder = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { surveyId } = useParams<SurveyParams>();
    const [searchParams] = useSearchParams();

    const [savedSurvey, setSavedSurvey] = useState<Survey | null>(null);
    const [formData, setFormData] = useState<(unknown & { components: unknown[] }) | null>(null);

    const [loading, setLoading] = useState(true);
    const [isNameFocused, setIsNamedFocused] = useState(false);
    const [name, setName] = useState(savedSurvey ? savedSurvey.name : '');
    const [isSaving, setIsSaving] = useState(false);
    const [savedEngagement, setSavedEngagement] = useState<Engagement | null>(null);

    const [formDefinition, setFormDefinition] = useState<FormBuilderData>({ display: 'form', components: [] });
    const isMultiPage = formDefinition.display === 'wizard';
    const hasEngagement = Boolean(savedSurvey?.engagement_id);
    const isEngagementDraft = savedEngagement?.status_id === EngagementStatus.Draft;
    const isNonDraftEngagement = hasEngagement && !isEngagementDraft;
    const [isHiddenSurvey, setIsHiddenSurvey] = useState(savedSurvey ? savedSurvey.is_hidden : false);
    const [isTemplateSurvey, setIsTemplateSurvey] = useState(savedSurvey ? savedSurvey.is_template : false);

    const engagementUnpublishedBeforeGoLive = useMemo(() => {
        const today = format(new Date(), 'yyyy-MM-dd');
        return savedEngagement?.status_id === EngagementStatus.Unpublished && today < savedEngagement?.start_date;
    }, [savedEngagement]);

    const engagementScheduledToGoLive = useMemo(() => {
        const today = format(new Date(), 'yyyy-MM-dd');
        return savedEngagement?.status_id === EngagementStatus.Scheduled && today < savedEngagement?.start_date;
    }, [savedEngagement]);

    const [autoSaveNotificationOpen, setAutoSaveNotificationOpen] = useState(false);
    const [tab, setTab] = useState(searchParams.get('tab') === TAB_REPORT ? TAB_REPORT : TAB_QUESTIONS);
    const AUTO_SAVE_INTERVAL = 5000;

    useEffect(() => {
        loadSurvey();
    }, []);

    useEffect(() => {
        if (savedEngagement && isNonDraftEngagement) {
            // Engagement scheduled to go live in the future
            if (engagementScheduledToGoLive || engagementUnpublishedBeforeGoLive) {
                dispatch(
                    openNotification({
                        severity: 'warning',
                        text: 'Engagement is scheduled to go live. Please be careful while editing the survey.',
                    }),
                );
            }
            // Engagement already published/was live
            else if (
                savedEngagement.status_id === EngagementStatus.Published ||
                savedEngagement.status_id === EngagementStatus.Unpublished
            ) {
                dispatch(
                    openNotification({
                        severity: 'warning',
                        text: 'Engagement already published. Please be careful while editing the survey.',
                    }),
                );
            }
        }
    }, [savedEngagement]);

    const loadSurvey = async () => {
        if (isNaN(Number(surveyId))) {
            navigate('/surveys');
            dispatch(
                openNotification({
                    severity: 'error',
                    text: 'The survey id passed was erroneous',
                }),
            );
            return;
        }
        try {
            const loadedSurvey = await getSurvey(Number(surveyId));
            setSavedSurvey(loadedSurvey);
            const loadedFormJson = loadedSurvey?.form_json || { display: 'form', components: [] };
            setFormDefinition(loadedFormJson);
            setFormData(loadedFormJson);
            setName(loadedSurvey.name);
            setIsHiddenSurvey(loadedSurvey.is_hidden);
            setIsTemplateSurvey(loadedSurvey.is_template);
        } catch (error) {
            dispatch(
                openNotification({
                    severity: 'error',
                    text: 'Error occurred while loading saved survey',
                }),
            );
            navigate('/surveys');
        }
    };

    useEffect(() => {
        if (savedSurvey) {
            loadEngagement();
        }
    }, [savedSurvey]);

    const loadEngagement = async () => {
        if (!savedSurvey?.engagement_id) {
            setLoading(false);
            return;
        }

        try {
            const loadedEngagement = await getEngagement(Number(savedSurvey.engagement_id));
            setSavedEngagement(loadedEngagement);
            setLoading(false);
        } catch (error) {
            dispatch(
                openNotification({
                    severity: 'error',
                    text: 'Error occurred while loading saved engagement data',
                }),
            );
            navigate('/survey/listing');
        }
    };

    const currentValuesRef = useRef({ name, isHiddenSurvey, isTemplateSurvey });

    useEffect(() => {
        currentValuesRef.current = { name, isHiddenSurvey, isTemplateSurvey };
    }, [name, isHiddenSurvey, isTemplateSurvey]);

    const autoSaveForm = async (newForm: SurveyForm) => {
        try {
            await putSurvey(newForm);
            setAutoSaveNotificationOpen(true);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const responseData = error.response?.data;
                const errorMessage =
                    typeof responseData === 'string'
                        ? responseData
                        : responseData?.message || 'Error occurred while auto-saving survey';
                dispatch(
                    openNotification({
                        severity: 'error',
                        text: errorMessage,
                    }),
                );
            } else {
                dispatch(
                    openNotification({
                        severity: 'error',
                        text: 'Error occurred while auto-saving survey',
                    }),
                );
            }
        }
    };

    const autoSaveFormRef = useRef(autoSaveForm);
    useEffect(() => {
        autoSaveFormRef.current = autoSaveForm;
    });

    const debounceAutoSaveForm = useRef(
        debounce((form: FormBuilderData) => {
            const { name, isHiddenSurvey, isTemplateSurvey } = currentValuesRef.current;
            autoSaveFormRef.current({
                id: String(surveyId),
                form_json: form,
                name: name,
                is_hidden: isHiddenSurvey,
                is_template: isTemplateSurvey,
            });
        }, AUTO_SAVE_INTERVAL),
    ).current;

    const handleFormChange = (form: FormBuilderData) => {
        if (!form.components) {
            return;
        }
        setFormData(form);
        debounceAutoSaveForm(form);
    };

    const doSaveForm = async () => {
        await putSurvey({
            id: String(surveyId),
            form_json: formData,
            name: name,
            is_hidden: isHiddenSurvey,
            is_template: isTemplateSurvey,
        });
    };

    const handleSaveForm = async (nextTab: string = TAB_REPORT) => {
        if (!savedSurvey) {
            dispatch(
                openNotification({
                    severity: 'error',
                    text: 'Unable to build survey, please reload',
                }),
            );
            return;
        }

        try {
            setIsSaving(true);
            await doSaveForm();
            dispatch(
                openNotification({
                    severity: 'success',
                    text: savedSurvey.engagement?.id
                        ? `Survey was successfully added to engagement`
                        : 'The survey was successfully built',
                }),
            );

            // formDefinition drives FormBuilder's remount key, so only sync it here (on save) -
            // not on every keystroke, which would remount the builder mid-typing.
            if (formData) {
                setFormDefinition(formData as FormBuilderData);
            }

            setTab(nextTab);
            setIsSaving(false);
        } catch (error) {
            setIsSaving(false);
            if (axios.isAxiosError(error)) {
                dispatch(
                    openNotification({
                        severity: 'error',
                        text: error.response?.data.message,
                    }),
                );
            } else {
                dispatch(
                    openNotification({
                        severity: 'error',
                        text: 'Error occurred while saving survey',
                    }),
                );
            }
        }
    };

    const reportSettingsRef = useRef<ReportSettingsPanelHandle>(null);

    // Switching tabs should never discard unsaved work: leaving the questions tab saves the
    // survey form, leaving the report tab flushes any pending visibility toggle changes.
    const handleTabChange = async (nextTab: string) => {
        if (nextTab === tab) {
            return;
        }
        if (tab === TAB_QUESTIONS) {
            await handleSaveForm(nextTab);
            return;
        }
        await reportSettingsRef.current?.save();
        setTab(nextTab);
    };

    if (loading) {
        return <FormBuilderSkeleton />;
    }

    return (
        <Box sx={{ pt: 3, backgroundColor: '#FAF9F8' }}>
            <Breadcrumb
                items={[
                    { label: 'Surveys', to: '/surveys' },
                    { label: name, to: `/surveys/${surveyId}/submit` },
                    { label: 'Edit survey' },
                ]}
            />
            <Box sx={{ px: { xs: 2, md: 3 }, pt: 2 }}>
                <Stack direction="row" justifyContent="flex-start" alignItems="center">
                    {!isNameFocused ? (
                        <>
                            <MetHeader3
                                sx={{ p: 0.5, color: '#013366' }}
                                onClick={() => {
                                    setIsNamedFocused(true);
                                }}
                            >
                                {name}
                            </MetHeader3>
                            <IconButton
                                size="small"
                                onClick={() => {
                                    setIsNamedFocused(!isNameFocused);
                                }}
                                color="inherit"
                            >
                                <BorderColorIcon sx={{ fontSize: '1rem' }} />
                            </IconButton>
                        </>
                    ) : (
                        <>
                            <TextField
                                autoFocus
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                onBlur={(event) => setIsNamedFocused(false)}
                            />
                            <IconButton
                                onClick={() => {
                                    setIsNamedFocused(!isNameFocused);
                                }}
                                color="inherit"
                            >
                                <ClearIcon />
                            </IconButton>
                        </>
                    )}
                </Stack>
                <Divider />
            </Box>
            <BuilderTabs
                tabs={[
                    {
                        value: TAB_QUESTIONS,
                        label: 'Survey questions',
                        icon: <ListAltOutlinedIcon />,
                    },
                    {
                        value: TAB_REPORT,
                        label: 'Public report settings',
                        icon: <AssessmentOutlinedIcon />,
                    },
                ]}
                value={tab}
                onChange={handleTabChange}
            />
            {tab === TAB_QUESTIONS && (
                <>
                    <Box
                        role="tabpanel"
                        id={tabIds(TAB_QUESTIONS).panel}
                        aria-labelledby={tabIds(TAB_QUESTIONS).tab}
                        sx={{ px: { xs: 2, md: 3 } }}
                    >
                        <Stack spacing={1} sx={{ pt: 1, borderBottom: '1px solid #E0E0E0', pb: 2, mb: 2 }}>
                            <Box sx={{ position: 'relative' }}>
                                <Box
                                    sx={{
                                        position: 'static',
                                        mb: 2,
                                        zIndex: 2,
                                        [FORMIO_BREAKPOINT_SM]: {
                                            position: 'absolute',
                                            top: 0,
                                            left: FORMAREA_LEFT,
                                            right: 0,
                                            mb: 0,
                                        },
                                    }}
                                >
                                    <FormGroup sx={{ alignItems: 'flex-start' }}>
                                        <FormControlLabel
                                            sx={{ m: 0, gap: '10px' }}
                                            slotProps={{ typography: { sx: { fontSize: '15px', color: '#2D2D2D' } } }}
                                            control={
                                                <SurveySwitch
                                                    checked={isMultiPage}
                                                    onChange={(e) => {
                                                        dispatch(
                                                            openNotificationModal({
                                                                open: true,
                                                                data: {
                                                                    header: 'Change Survey Type',
                                                                    subText: [
                                                                        {
                                                                            text: `You will be changing the survey type from ${
                                                                                isMultiPage
                                                                                    ? 'multi page to single page'
                                                                                    : 'single page to multi page'
                                                                            }.`,
                                                                        },
                                                                        {
                                                                            text: 'You will lose all current progress if you do.',
                                                                            bold: true,
                                                                        },
                                                                        {
                                                                            text: 'Do you want to change this survey type?',
                                                                        },
                                                                    ],
                                                                    handleConfirm: () => {
                                                                        setFormDefinition({
                                                                            display: isMultiPage ? 'form' : 'wizard',
                                                                            components: [],
                                                                        });
                                                                    },
                                                                },
                                                                type: 'confirm',
                                                            }),
                                                        );
                                                    }}
                                                />
                                            }
                                            label="Multi-page"
                                        />
                                    </FormGroup>
                                </Box>
                                <FormBuilder
                                    handleFormChange={handleFormChange}
                                    savedForm={formDefinition}
                                    isLoading={loading}
                                />
                            </Box>
                            <Box
                                sx={{
                                    pl: 0,
                                    [FORMIO_BREAKPOINT_SM]: { pl: FORMAREA_LEFT },
                                }}
                            >
                                <AdditionalSettings
                                    isTemplateSurvey={isTemplateSurvey}
                                    onTemplateChange={setIsTemplateSurvey}
                                    isHiddenSurvey={isHiddenSurvey}
                                    onHiddenChange={setIsHiddenSurvey}
                                    disabled={Boolean(savedSurvey?.engagement_id)}
                                />
                            </Box>
                        </Stack>
                    </Box>
                    <Box
                        sx={{
                            position: 'sticky',
                            bottom: 0,
                            mt: 3,
                            py: 2,
                            px: { xs: 2, md: 3 },
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: 2,
                            backgroundColor: '#fff',
                            borderTop: '1px solid #D8D8D8',
                            boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.06)',
                        }}
                    >
                        <SecondaryButton
                            disabled={!formData}
                            loading={isSaving}
                            onClick={() => handleSaveForm(TAB_QUESTIONS)}
                        >
                            Save
                        </SecondaryButton>
                        <PrimaryButton
                            disabled={!formData}
                            loading={isSaving}
                            endIcon={<ArrowForwardIcon />}
                            onClick={() => handleSaveForm(TAB_REPORT)}
                        >
                            Next: Public report settings
                        </PrimaryButton>
                    </Box>
                </>
            )}
            {tab === TAB_REPORT && (
                <Box
                    role="tabpanel"
                    id={tabIds(TAB_REPORT).panel}
                    aria-labelledby={tabIds(TAB_REPORT).tab}
                    sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, md: 3 } }}
                >
                    <ReportSettingsPanel
                        ref={reportSettingsRef}
                        surveyId={String(surveyId)}
                        engagementId={savedSurvey?.engagement_id || undefined}
                        formDefinition={formDefinition}
                    />
                </Box>
            )}
            <AutoSaveSnackBar
                open={autoSaveNotificationOpen}
                handleClose={() => {
                    setAutoSaveNotificationOpen(false);
                }}
            />
        </Box>
    );
};

export default SurveyFormBuilder;

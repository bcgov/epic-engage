import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Grid, Stack, Divider, TextField, IconButton, Switch, FormGroup, FormControlLabel, Box } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import FormBuilder from 'components/shared/form/FormBuilder';
import BorderColorIcon from '@mui/icons-material/BorderColor';
import ClearIcon from '@mui/icons-material/Clear';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import { SurveyParams } from '../types';
import { getSurvey, putSurvey } from 'services/surveyService';
import { Survey } from 'models/survey';
import { useAppDispatch } from 'hooks';
import { openNotification } from 'services/notificationService/notificationSlice';
import {
    MetHeader3,
    MetParagraph,
    MetPageGridContainer,
    PrimaryButton,
    SecondaryButton,
} from 'components/shared/common';
import FormBuilderSkeleton from './FormBuilderSkeleton';
import { FormBuilderData } from 'components/shared/form/FormBuilder/types';
import { EngagementStatus } from 'constants/engagementStatus';
import { getEngagement } from 'services/engagementService';
import { Engagement } from 'models/engagement';
import { openNotificationModal } from 'services/notificationModalService/notificationModalSlice';
import axios from 'axios';
import { AutoSaveSnackBar } from './AutoSaveSnackBar';
import { AdditionalSettings } from './AdditionalSettings';
import { BuilderTabs, tabIds } from './BuilderTabs';
import { debounce } from 'lodash';
import { format } from 'date-fns';

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
    const [tab, setTab] = useState('questions');
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

    const handleSaveForm = async () => {
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

            navigate(`/surveys/${savedSurvey.id}/report`);
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

    if (loading) {
        return <FormBuilderSkeleton />;
    }

    return (
        <MetPageGridContainer
            container
            direction="row"
            alignItems="flex-start"
            justifyContent="flex-start"
            item
            xs={12}
            spacing={4}
        >
            <Grid item xs={12}>
                <Stack direction="row" justifyContent="flex-start" alignItems="center">
                    {!isNameFocused ? (
                        <>
                            <MetHeader3
                                sx={{ p: 0.5 }}
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
            </Grid>
            <Grid item xs={12}>
                <BuilderTabs
                    tabs={[
                        {
                            value: 'questions',
                            label: 'Survey questions',
                            icon: <ListAltOutlinedIcon />,
                        },
                        {
                            value: 'report',
                            label: 'Public report settings',
                            icon: <AssessmentOutlinedIcon />,
                        },
                    ]}
                    value={tab}
                    onChange={setTab}
                />
                {tab === 'questions' && (
                    <Box role="tabpanel" id={tabIds('questions').panel} aria-labelledby={tabIds('questions').tab}>
                        <Stack spacing={1} sx={{ pt: 1, borderBottom: '1px solid #E0E0E0', pb: 2, mb: 2 }}>
                            <Stack direction="row">
                                <FormGroup>
                                    <FormControlLabel
                                        control={
                                            <Switch
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
                            </Stack>
                            <FormBuilder
                                handleFormChange={handleFormChange}
                                savedForm={formDefinition}
                                isLoading={loading}
                            />
                            <AdditionalSettings
                                isTemplateSurvey={isTemplateSurvey}
                                onTemplateChange={setIsTemplateSurvey}
                                isHiddenSurvey={isHiddenSurvey}
                                onHiddenChange={setIsHiddenSurvey}
                                disabled={Boolean(savedSurvey?.engagement_id)}
                            />
                            <Stack direction="row" spacing={2}>
                                <PrimaryButton disabled={!formData} loading={isSaving} onClick={handleSaveForm}>
                                    {'Report Settings'}
                                </PrimaryButton>
                                <SecondaryButton onClick={() => navigate('/surveys')}>Cancel</SecondaryButton>
                            </Stack>
                        </Stack>
                    </Box>
                )}
                {tab === 'report' && (
                    <Box role="tabpanel" id={tabIds('report').panel} aria-labelledby={tabIds('report').tab}>
                        <MetParagraph sx={{ pt: 2 }}>will be done in ENGAGE-239.</MetParagraph>
                    </Box>
                )}
            </Grid>
            <AutoSaveSnackBar
                open={autoSaveNotificationOpen}
                handleClose={() => {
                    setAutoSaveNotificationOpen(false);
                }}
            />
        </MetPageGridContainer>
    );
};

export default SurveyFormBuilder;

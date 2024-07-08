import React, { createContext, useEffect, useState } from 'react';
import { SurveyReportSetting } from 'models/surveyReportSetting';
import { useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { openNotification } from 'services/notificationService/notificationSlice';
import { fetchSurveyReportSettings, updateSurveyReportSettings } from 'services/surveyService/reportSettingsService';
import { getSurvey } from 'services/surveyService';
import { Survey } from 'models/survey';
import { getSlugByEngagementId } from 'services/engagementSlugService';
import { FormInfo } from 'components/Form/types';

export interface SearchFilter {
    key: keyof SurveyReportSetting;
    value: string;
}
export interface SurveyReportSettingsContextProps {
    tableLoading: boolean;
    surveyReportSettings: SurveyReportSetting[];
    searchFilter: SearchFilter;
    setSearchFilter: React.Dispatch<React.SetStateAction<SearchFilter>>;
    savingSettings: boolean;
    setSavingSettings: React.Dispatch<React.SetStateAction<boolean>>;
    handleSaveSettings: (settings: SurveyReportSetting[]) => void;
    survey: Survey | null;
    loadingEngagementSlug: boolean;
    engagementSlug: string | null;
}

export const ReportSettingsContext = createContext<SurveyReportSettingsContextProps>({
    tableLoading: false,
    surveyReportSettings: [],
    searchFilter: { key: 'question', value: '' },
    setSearchFilter: () => {
        throw new Error('setSearchFilter function must be overridden');
    },
    savingSettings: false,
    setSavingSettings: () => {
        throw new Error('setSavingSettings function must be overridden');
    },
    handleSaveSettings: () => {
        throw new Error('handleSaveSettings function must be overridden');
    },
    survey: null,
    loadingEngagementSlug: false,
    engagementSlug: null,
});

export const ReportSettingsContextProvider = ({ children }: { children: JSX.Element | JSX.Element[] }) => {
    const [tableLoading, setTableLoading] = useState<boolean>(false);
    const [searchFilter, setSearchFilter] = useState<SearchFilter>({
        key: 'question',
        value: '',
    });
    const [surveyReportSettings, setSurveyReportSettings] = useState<SurveyReportSetting[]>([]);
    const [savingSettings, setSavingSettings] = useState<boolean>(false);
    const [survey, setSurvey] = useState<Survey | null>(null);
    const [loadingSurvey, setLoadingSurvey] = useState<boolean>(true);
    const [loadingEngagementSlug, setLoadingEngagementSlug] = useState<boolean>(true);
    const [engagementSlug, setEngagementSlug] = useState<string | null>(null);

    const { surveyId } = useParams<{ surveyId: string }>();

    const dispatch = useDispatch();
    const navigate = useNavigate();

    const loadSurveySettings = async () => {
        if (!surveyId || isNaN(Number(surveyId))) {
            navigate('/surveys');
            return;
        }
        try {
            setTableLoading(true);
            const settings = await fetchSurveyReportSettings(surveyId);
            sortSurvey(settings);
            setSurveyReportSettings(settings);
            setTableLoading(false);
        } catch (error) {
            dispatch(
                openNotification({
                    severity: 'error',
                    text: 'Error occurred while loading settings. Please try again.',
                }),
            );
        }
    };

    const loadSurvey = async () => {
        if (!surveyId || isNaN(Number(surveyId))) {
            return;
        }
        try {
            const settings = await getSurvey(Number(surveyId));
            setSurvey(settings);
            setLoadingSurvey(false);
        } catch (error) {
            setLoadingSurvey(false);
        }
    };

    const loadEngagementSlug = async () => {
        if (!survey) {
            dispatch(openNotification({ severity: 'error', text: 'Failed to load dashboard link.' }));
            return;
        }

        if (!survey.engagement_id) {
            setLoadingEngagementSlug(false);
            return;
        }

        try {
            const slug = await getSlugByEngagementId(survey.engagement_id);
            setEngagementSlug(slug.slug);
            setLoadingEngagementSlug(false);
        } catch (error) {
            setLoadingEngagementSlug(false);
            dispatch(openNotification({ severity: 'error', text: 'Failed to load dashboard link.' }));
        }
    };

    const sortSurvey = (surveyReportSettings: SurveyReportSetting[]) => {
        const isMultiPage = survey?.form_json?.display === 'wizard';
        const questionOrder: Array<string> = [];

        if (isMultiPage) {
            // Parse multi-page survey form json
            const pages = survey?.form_json?.components || [];
            const numPages = pages?.length || 0;
            for (let pageNum = 0; pageNum < numPages; pageNum++) {
                const page = pages[pageNum];
                const questions: Array<FormInfo> = page?.components as Array<FormInfo>;
                parseQuestions(questions, questionOrder);
            }
        } else {
            // Parse single-page survey form json
            const questions: Array<FormInfo> = survey?.form_json?.components as Array<FormInfo>;
            parseQuestions(questions, questionOrder);
        }

        surveyReportSettings.sort(
            (x, y) => questionOrder.indexOf(x.question_id.toString()) - questionOrder.indexOf(y.question_id.toString()),
        );
    };

    const parseQuestions = (questions: Array<FormInfo>, questionOrder: Array<string>) => {
        const numQuestions = questions?.length || 0;
        for (let questionNum = 0; questionNum < numQuestions; questionNum++) {
            if (questions.at(questionNum)?.type === 'simplesurvey') {
                const simpleSurveyOptions = questions.at(questionNum)?.questions as [{ value: string }];
                simpleSurveyOptions.forEach((question) => {
                    questionOrder.push(`${questions.at(questionNum)?.id}-${question.value}`);
                });
            } else {
                questionOrder.push(questions.at(questionNum)?.id as string);
            }
        }
    };

    useEffect(() => {
        loadSurvey();
    }, [surveyId]);

    useEffect(() => {
        loadSurveySettings();
    }, [survey]);

    useEffect(() => {
        if (!loadingSurvey) {
            loadEngagementSlug();
        }
    }, [loadingSurvey]);

    const handleNavigateOnSave = () => {
        if (survey?.engagement_id) {
            navigate(`/engagements/${survey.engagement_id}/form`);
            return;
        }
        navigate(`/surveys`);
    };
    const handleSaveSettings = async (settings: SurveyReportSetting[]) => {
        if (!surveyId || isNaN(Number(surveyId))) {
            setSavingSettings(false);
            return;
        }

        if (!settings.length) {
            handleNavigateOnSave();
            return;
        }

        try {
            await updateSurveyReportSettings(surveyId, settings);
            setSavingSettings(false);
            dispatch(
                openNotification({
                    severity: 'success',
                    text: 'Settings saved successfully.',
                }),
            );
            handleNavigateOnSave();
        } catch (error) {
            dispatch(
                openNotification({
                    severity: 'error',
                    text: 'Error occurred while saving settings. Please try again.',
                }),
            );
            setSavingSettings(false);
        }
    };

    return (
        <ReportSettingsContext.Provider
            value={{
                tableLoading,
                surveyReportSettings,
                searchFilter,
                setSearchFilter,
                savingSettings,
                setSavingSettings,
                handleSaveSettings,
                survey,
                engagementSlug,
                loadingEngagementSlug,
            }}
        >
            {children}
        </ReportSettingsContext.Provider>
    );
};

import { useMemo, useRef, useState } from 'react';
import { Box, Skeleton } from '@mui/material';
import { MetHeader4 } from 'components/shared/common';
import { ErrorBox } from 'components/shared/analytics/ErrorBox';
import { NoData } from 'components/shared/analytics/NoData';
import { Engagement } from 'models/engagement';
import { useSurveyComments } from '../hooks/useSurveyComments';
import { useFixedHeaderOffset } from '../hooks/useFixedHeaderOffset';
import { buildCommentSections } from './buildCommentSections';
import { CommentsSidebarToc } from './CommentsSidebarToc';
import { CommentSection } from './CommentSection';
import { Palette } from 'styles/Theme';

interface CommentsTabProps {
    engagement: Engagement;
    engagementIsLoading: boolean;
    dashboardType: string;
}

export const CommentsTab = ({ engagement, engagementIsLoading, dashboardType }: CommentsTabProps) => {
    const surveyId = engagement.surveys?.[0]?.id;
    const { data, pages, conditionalLinks, isLoading, isError, refetch } = useSurveyComments(
        Number(engagement.id),
        surveyId ? Number(surveyId) : undefined,
        dashboardType,
    );
    // buildResultPages only groups by wizard page when the form is a multi-page wizard;
    // fall back to a single unnamed page over the flat result list otherwise (mirrors
    // ChartPreview's fallback to data.data when pages is null).
    const effectivePages = useMemo(
        () =>
            pages ??
            (data?.data?.length ? [{ title: '', questions: data.data, keys: data.data.map((q) => q.key) }] : null),
        [pages, data],
    );
    const sections = useMemo(
        () => buildCommentSections(effectivePages, conditionalLinks),
        [effectivePages, conditionalLinks],
    );
    const headerOffset = useFixedHeaderOffset();
    const [activeId, setActiveId] = useState<string | null>(null);
    const sectionRefs = useRef(new Map<string, HTMLDivElement>());

    // The highlight marks where the reader was sent.
    const handleNavigate = (id: string) => {
        const el = sectionRefs.current.get(id);
        if (!el) {
            return;
        }
        setActiveId(id);
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const registerRef = (id: string, el: HTMLDivElement | null) => {
        if (el) {
            sectionRefs.current.set(id, el);
        } else {
            sectionRefs.current.delete(id);
        }
    };

    if (isLoading || engagementIsLoading) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 4 }}>
                <Skeleton variant="rectangular" height={300} />
                <Skeleton variant="rectangular" height={300} />
            </Box>
        );
    }

    if (isError) {
        return <ErrorBox sx={{ mt: 4 }} onClick={refetch} />;
    }

    if (!data?.data?.length || !sections.length) {
        return <NoData sx={{ mt: 4 }} />;
    }

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 0,
                mt: 4,
                // Consumed by every sticky element in the tab so they all pin below the app bar.
                '--comments-sticky-top': `${headerOffset}px`,
            }}
        >
            <CommentsSidebarToc sections={sections} activeId={activeId} onNavigate={handleNavigate} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <MetHeader4 sx={{ mb: 3, color: Palette.primary.main }}>All Comments</MetHeader4>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {sections.map((section) => (
                        <CommentSection key={section.id} section={section} registerRef={registerRef} />
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

export default CommentsTab;

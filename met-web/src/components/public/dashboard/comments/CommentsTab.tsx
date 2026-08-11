import { useEffect, useMemo, useRef, useState } from 'react';
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

// How long a TOC click keeps the highlight before the scroll spy takes over again.
const NAVIGATION_SETTLE_MS = 1000;

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
    const intersectingIds = useRef(new Set<string>());
    const pendingId = useRef<string | null>(null);
    const settleTimer = useRef<ReturnType<typeof setTimeout>>();

    // Watch deepest entries: a section wrapper always intersects.
    const observedIds = useMemo(
        () => sections.flatMap((section) => section.subSections?.map((sub) => sub.id) ?? [section.id]),
        [sections],
    );

    useEffect(() => {
        intersectingIds.current.clear();
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        intersectingIds.current.add(entry.target.id);
                    } else {
                        intersectingIds.current.delete(entry.target.id);
                    }
                });

                const topmost = observedIds.find((id) => intersectingIds.current.has(id));
                if (!topmost) {
                    return;
                }
                if (pendingId.current) {
                    if (pendingId.current === topmost) {
                        pendingId.current = null;
                    }
                    return;
                }
                setActiveId(topmost);
            },
            { rootMargin: `-${headerOffset + 16}px 0px -70% 0px`, threshold: 0 },
        );

        observedIds.forEach((id) => {
            const el = sectionRefs.current.get(id);
            if (el) {
                observer.observe(el);
            }
        });
        return () => observer.disconnect();
    }, [observedIds, headerOffset]);

    useEffect(() => () => clearTimeout(settleTimer.current), []);

    const handleNavigate = (id: string) => {
        const el = sectionRefs.current.get(id);
        if (!el) {
            return;
        }
        const section = sections.find((candidate) => candidate.id === id);
        const leafId = section?.subSections?.[0]?.id ?? id;
        pendingId.current = leafId;
        setActiveId(leafId);
        clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => {
            pendingId.current = null;
        }, NAVIGATION_SETTLE_MS);
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

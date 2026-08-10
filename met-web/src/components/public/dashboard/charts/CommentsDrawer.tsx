import { useEffect, useRef, useState } from 'react';
import { Box, Drawer, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { MetHeader4, MetDescription } from 'components/shared/common';
import { QuestionTypeLabel } from './QuestionTypeLabel';
import { Palette } from 'styles/Theme';

const DRAWER_HEIGHT = '100vh';

// How far past the top of the scroll area a heading counts as the section being read.
const SCROLL_SPY_OFFSET = 20;

// A Likert row / Ranking statement whose follow-up was merged into one conditional block.
export interface CommentsDrawerSection {
    rowLabel?: string;
    question: string;
    responses: string[];
}

interface CommentsDrawerProps {
    open: boolean;
    onClose: () => void;
    question: string;
    responses: string[];
    questionType?: string;
    // When set, comments are grouped under a heading per section and `responses` is ignored.
    sections?: CommentsDrawerSection[];
}

const renderResponses = (responses: string[]) =>
    responses.map((response, responseIndex) => (
        <Box
            key={`response-${responseIndex}`}
            sx={{
                p: '10px 14px',
                borderRadius: '0 6px 6px 0',
                border: `1px solid ${Palette.border.default}`,
                borderLeft: `3px solid ${Palette.primary.main}`,
                backgroundColor: Palette.background.default,
                mb: 1,
            }}
        >
            <MetDescription
                sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: Palette.text.secondary,
                    lineHeight: 1.5,
                }}
            >
                {response}
            </MetDescription>
        </Box>
    ));

const countComments = (responses: string[], sections?: CommentsDrawerSection[]) =>
    sections?.length ? sections.reduce((total, section) => total + section.responses.length, 0) : responses.length;

const sectionTitle = (section: CommentsDrawerSection) => section.rowLabel ?? section.question;

const commentCount = (count: number) => `${count.toLocaleString()} comment${count === 1 ? '' : 's'}`;

export const CommentsDrawer = ({ open, onClose, question, responses, questionType, sections }: CommentsDrawerProps) => {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const headingRefs = useRef<(HTMLElement | null)[]>([]);
    const [activeSection, setActiveSection] = useState(0);
    const hasJumpMenu = (sections?.length ?? 0) > 1;

    useEffect(() => {
        if (open) {
            setActiveSection(0);
        }
    }, [open]);

    const scrollToSection = (index: number) => {
        setActiveSection(index);
        headingRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // The last heading to have passed the top of the scroll area is the one being read.
    const handleScroll = () => {
        const container = scrollRef.current;
        if (!container || !hasJumpMenu) {
            return;
        }
        const containerTop = container.getBoundingClientRect().top;
        let active = 0;
        headingRefs.current.forEach((heading, index) => {
            if (heading && heading.getBoundingClientRect().top - containerTop <= SCROLL_SPY_OFFSET) {
                active = index;
            }
        });
        setActiveSection(active);
    };

    const renderJumpMenu = (menuSections: CommentsDrawerSection[]) => (
        <Box
            component="nav"
            aria-label="Jump to a question"
            sx={{
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                p: '12px 24px',
                borderBottom: `1px solid ${Palette.border.default}`,
                backgroundColor: Palette.chart.surface.rowHover,
                // A matrix carries a follow-up per row, so cap the menu instead of letting it
                // push the comments off the screen.
                maxHeight: '30vh',
                overflowY: 'auto',
            }}
        >
            <Typography
                sx={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: Palette.text.secondary,
                    mb: 1,
                }}
            >
                Jump to
            </Typography>
            {menuSections.map((section, index) => {
                const isActive = index === activeSection;
                return (
                    <Box
                        component="button"
                        type="button"
                        key={`jump-${index}`}
                        onClick={() => scrollToSection(index)}
                        aria-current={isActive || undefined}
                        sx={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: '10px',
                            width: '100%',
                            p: '4px 0',
                            border: 'none',
                            background: 'none',
                            fontFamily: 'inherit',
                            textAlign: 'left',
                            cursor: 'pointer',
                            color: Palette.action.active,
                            '&:hover .jump-label': { textDecoration: 'underline' },
                        }}
                    >
                        <Box
                            sx={{
                                fontSize: '11px',
                                fontWeight: 700,
                                minWidth: '18px',
                                flexShrink: 0,
                                color: isActive ? Palette.primary.main : Palette.text.disabled,
                            }}
                        >
                            {index + 1}
                        </Box>
                        <Box
                            className="jump-label"
                            sx={{
                                flex: 1,
                                fontSize: '13px',
                                lineHeight: 1.4,
                                fontWeight: isActive ? 700 : 400,
                                color: isActive ? Palette.primary.main : 'inherit',
                            }}
                        >
                            {sectionTitle(section)}{' '}
                            <Box
                                component="span"
                                sx={{ fontWeight: 400, fontSize: '11px', color: Palette.text.secondary }}
                            >
                                ({commentCount(section.responses.length)})
                            </Box>
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );

    const renderSections = (bodySections: CommentsDrawerSection[]) =>
        bodySections.map((section, sectionIndex) => (
            <Box key={`section-${sectionIndex}`} sx={{ mb: 3 }}>
                <Box
                    ref={(element: HTMLElement | null) => {
                        headingRefs.current[sectionIndex] = element;
                    }}
                    sx={{ scrollMarginTop: '8px' }}
                >
                    <Stack direction="row" alignItems="center" gap={1} sx={{ mb: '6px' }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 700, color: Palette.text.primary }}>
                            {sectionTitle(section)}
                        </Typography>
                        <Box
                            sx={{
                                fontSize: '11px',
                                color: Palette.text.secondary,
                                backgroundColor: Palette.background.default,
                                border: `1px solid ${Palette.border.default}`,
                                borderRadius: '20px',
                                p: '2px 8px',
                            }}
                        >
                            {commentCount(section.responses.length)}
                        </Box>
                    </Stack>
                    {section.rowLabel && (
                        <MetDescription sx={{ color: Palette.text.secondary, mb: 1 }}>
                            {section.question}
                        </MetDescription>
                    )}
                </Box>
                {renderResponses(section.responses)}
            </Box>
        ));

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            // The logged-in InternalHeader is a fixed AppBar at theme.zIndex.drawer + 1; go
            // above it so this drawer covers the full screen, header included, while open.
            sx={{ zIndex: (theme) => theme.zIndex.drawer + 2 }}
            PaperProps={{
                sx: {
                    height: DRAWER_HEIGHT,
                    borderTopLeftRadius: '12px',
                    borderTopRightRadius: '12px',
                },
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    p: '20px 24px 12px 24px',
                    borderBottom: `1px solid ${Palette.border.default}`,
                }}
            >
                <Box>
                    {questionType && <QuestionTypeLabel label={questionType} />}
                    <MetHeader4 sx={{ lineHeight: 1.4 }}>{question}</MetHeader4>
                    <MetDescription sx={{ color: Palette.text.disabled }}>
                        {commentCount(countComments(responses, sections))}
                    </MetDescription>
                </Box>
                <IconButton aria-label="Close comments" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Box>
            {hasJumpMenu && sections && renderJumpMenu(sections)}
            <Box
                ref={scrollRef}
                onScroll={handleScroll}
                sx={{ flex: 1, overflowY: 'auto', p: '16px 24px', backgroundColor: Palette.chart.surface.drawer }}
            >
                {sections?.length ? renderSections(sections) : renderResponses(responses)}
            </Box>
        </Drawer>
    );
};

export default CommentsDrawer;

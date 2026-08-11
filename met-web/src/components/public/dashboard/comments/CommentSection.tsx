import { Box } from '@mui/material';
import { MetHeader4, MetDescription } from 'components/shared/common';
import { CommentSection as CommentSectionData } from './buildCommentSections';
import { CommentItem } from './CommentItem';
import { Palette } from 'styles/Theme';

interface CommentSectionProps {
    section: CommentSectionData;
    registerRef: (id: string, el: HTMLDivElement | null) => void;
}

// formio leaves an unnamed wizard page titled "Page 3", remove duplicate numbers if defaulted
const describePage = (pageNumber: number, pageTitle: string) =>
    /^page\s*\d/i.test(pageTitle) ? pageTitle : `Page ${pageNumber} – ${pageTitle}`;

const describeSection = ({ commentCount, pageNumber, pageTitle }: CommentSectionData) => {
    const comments = `${commentCount.toLocaleString()} comment${commentCount === 1 ? '' : 's'}`;
    return pageTitle ? `${comments} · ${describePage(pageNumber, pageTitle)}` : comments;
};

export const CommentSection = ({ section, registerRef }: CommentSectionProps) => {
    return (
        <Box
            id={section.id}
            ref={(el: HTMLDivElement | null) => registerRef(section.id, el)}
            sx={{ scrollMarginTop: 'calc(var(--comments-sticky-top, 0px) + 12px)' }}
        >
            <Box
                sx={{
                    position: 'sticky',
                    top: 'var(--comments-sticky-top, 0px)',
                    backgroundColor: Palette.background.default,
                    zIndex: 2,
                    padding: '12px 0 8px',
                    borderBottom: `2px solid ${Palette.primary.main}`,
                    mb: '12px',
                }}
            >
                <MetHeader4 sx={{ color: Palette.primary.main, fontSize: '15px', lineHeight: 1.4 }}>
                    {section.title}
                </MetHeader4>
                <MetDescription sx={{ mt: '2px', fontSize: '12px', lineHeight: 1.4 }}>
                    {describeSection(section)}
                </MetDescription>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {section.subSections
                    ? section.subSections.map((sub) => (
                          <Box
                              key={sub.id}
                              id={sub.id}
                              ref={(el: HTMLDivElement | null) => registerRef(sub.id, el)}
                              // Clears the app bar and the section's own sticky header above it.
                              sx={{ scrollMarginTop: 'calc(var(--comments-sticky-top, 0px) + 80px)' }}
                          >
                              <MetDescription
                                  sx={{
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      letterSpacing: '.06em',
                                      textTransform: 'uppercase',
                                      color: Palette.text.secondary,
                                      padding: '12px 0 6px',
                                      borderBottom: `1px solid ${Palette.border.default}`,
                                      mb: '6px',
                                  }}
                              >
                                  {sub.label}
                              </MetDescription>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  {sub.responses.map((text, index) => (
                                      <CommentItem key={`${sub.id}-${index}`} text={text} />
                                  ))}
                              </Box>
                          </Box>
                      ))
                    : section.responses?.map((text, index) => (
                          <CommentItem key={`${section.id}-${index}`} text={text} />
                      ))}
            </Box>
        </Box>
    );
};

export default CommentSection;

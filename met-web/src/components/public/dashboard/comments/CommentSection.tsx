import { Box } from '@mui/material';
import { MetHeader4, MetDescription } from 'components/shared/common';
import { CommentSection as CommentSectionData } from './buildCommentSections';
import { CommentItem } from './CommentItem';

interface CommentSectionProps {
    section: CommentSectionData;
    registerRef: (id: string, el: HTMLDivElement | null) => void;
}

const CountPill = ({ count }: { count: number }) => (
    <Box
        component="span"
        sx={{
            fontSize: '11px',
            color: '#474543',
            backgroundColor: '#F2F2F2',
            border: '1px solid #d8d8d8',
            borderRadius: '20px',
            padding: '2px 10px',
            ml: 1,
        }}
    >
        {count} comment{count === 1 ? '' : 's'}
    </Box>
);

export const CommentSection = ({ section, registerRef }: CommentSectionProps) => {
    return (
        <Box id={section.id} ref={(el: HTMLDivElement | null) => registerRef(section.id, el)} sx={{ scrollMarginTop: '12px' }}>
            <Box
                sx={{
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#fff',
                    zIndex: 2,
                    padding: '12px 0 8px',
                    borderBottom: '2px solid #013366',
                    mb: '12px',
                }}
            >
                <MetHeader4 sx={{ display: 'inline', color: '#013366' }}>
                    {section.title}
                    <CountPill count={section.commentCount} />
                </MetHeader4>
                <MetDescription sx={{ mt: '2px', fontSize: '12px' }}>{section.pageTitle}</MetDescription>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {section.subSections
                    ? section.subSections.map((sub) => (
                          <Box
                              key={sub.id}
                              id={sub.id}
                              ref={(el: HTMLDivElement | null) => registerRef(sub.id, el)}
                              sx={{ scrollMarginTop: '80px' }}
                          >
                              <MetDescription
                                  sx={{
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      letterSpacing: '.06em',
                                      textTransform: 'uppercase',
                                      color: '#474543',
                                      padding: '12px 0 6px',
                                      borderBottom: '1px solid #d8d8d8',
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
                    : section.responses?.map((text, index) => <CommentItem key={`${section.id}-${index}`} text={text} />)}
            </Box>
        </Box>
    );
};

export default CommentSection;

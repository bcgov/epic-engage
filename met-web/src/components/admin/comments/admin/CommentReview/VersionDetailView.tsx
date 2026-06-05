import { FC } from 'react';
import { Grid, Divider, Chip, Stack, Box } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { SubmissionVersion, VersionStaffNote, VersionComment } from 'models/submissionVersion';
import { CommentStatus, COMMENTS_STATUS } from 'constants/commentStatus';
import { formatDate } from 'utils/helpers/dateHelper';
import {
    MetLabel,
    MetParagraph,
    MetHeader3,
    MetHeader4,
    SecondaryButton,
    MetPageGridContainer,
} from 'components/shared/common';

interface VersionDetailViewProps {
    version: SubmissionVersion;
    onBack: () => void;
}

const VersionDetailView: FC<VersionDetailViewProps> = ({ version, onBack }) => {
    const statusLabel = COMMENTS_STATUS[version.comment_status_id as CommentStatus] ?? 'Unknown';
    const isRejected = version.comment_status_id === CommentStatus.Rejected;

    const reviewNotes = version.staff_note_json.filter((n: VersionStaffNote) => n.note_type === 'Review');
    const internalNotes = version.staff_note_json.filter((n: VersionStaffNote) => n.note_type === 'Internal');

    return (
        <MetPageGridContainer>
            <Grid
                container
                direction="row"
                padding="3em"
                justifyContent="flex-start"
                alignItems="flex-start"
                rowSpacing={4}
            >
                {/* Back button and version header */}
                <Grid item xs={12}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <SecondaryButton onClick={onBack} startIcon={<ArrowBackIcon />}>
                            Back to Current
                        </SecondaryButton>
                        <Chip label={`Version ${version.version_number}`} color="default" variant="outlined" />
                        <Chip
                            label={statusLabel}
                            size="small"
                            color={isRejected ? 'error' : 'default'}
                            variant={isRejected ? 'filled' : 'outlined'}
                        />
                        <MetParagraph sx={{ color: '#707070', fontStyle: 'italic' }}>(View Only)</MetParagraph>
                    </Stack>
                </Grid>

                {/* Comment Information */}
                <Grid container direction="row" item rowSpacing={2}>
                    <Grid container direction="row" item xs={6} spacing={1}>
                        <Grid item>
                            <MetLabel>Status:</MetLabel>
                        </Grid>
                        <Grid item>
                            <MetParagraph sx={{ pl: 2 }}>{statusLabel}</MetParagraph>
                        </Grid>
                    </Grid>

                    <Grid container direction="row" item xs={6} spacing={1}>
                        <Grid item>
                            <MetLabel>Reviewed by:</MetLabel>
                        </Grid>
                        <Grid item>
                            <MetParagraph sx={{ pl: 2 }}>{version.reviewed_by || '—'}</MetParagraph>
                        </Grid>
                    </Grid>

                    <Grid container direction="row" item xs={6} spacing={1}>
                        <Grid item>
                            <MetLabel>Date Reviewed:</MetLabel>
                        </Grid>
                        <Grid item>
                            <MetParagraph sx={{ pl: 2 }}>
                                {version.review_date ? formatDate(version.review_date) : '—'}
                            </MetParagraph>
                        </Grid>
                    </Grid>

                    <Grid container direction="row" item xs={6} spacing={1}>
                        <Grid item>
                            <MetLabel>Version Created:</MetLabel>
                        </Grid>
                        <Grid item>
                            <MetParagraph sx={{ pl: 2 }}>
                                {version.created_date ? formatDate(version.created_date) : '—'}
                            </MetParagraph>
                        </Grid>
                    </Grid>
                </Grid>

                {/* Comment Text */}
                <Grid container rowSpacing={2} paddingTop={5}>
                    <Grid item xs={12}>
                        <MetHeader3>Comment(s)</MetHeader3>
                    </Grid>
                    {version.comment_json.map((comment: VersionComment, index: number) => (
                        <Grid key={comment.id || index} item xs={12}>
                            <Divider />
                            <Grid container direction="row" alignItems="flex-start" sx={{ pt: 2 }}>
                                <Grid item xs={12}>
                                    <MetLabel>{comment.component_id || `Comment ${index + 1}`}</MetLabel>
                                </Grid>
                                <Grid item xs={12}>
                                    <MetParagraph>{comment.text}</MetParagraph>
                                </Grid>
                            </Grid>
                        </Grid>
                    ))}
                    <Grid item xs={12}>
                        <Divider />
                    </Grid>
                </Grid>

                {/* Rejection Reasons (if rejected) */}
                {isRejected && (
                    <Grid container rowSpacing={1} paddingTop={3}>
                        <Grid item xs={12}>
                            <MetHeader4>Reason for Rejection</MetHeader4>
                        </Grid>
                        {version.has_personal_info && (
                            <Grid item xs={12}>
                                <MetParagraph>• Contains personal information</MetParagraph>
                            </Grid>
                        )}
                        {version.has_profanity && (
                            <Grid item xs={12}>
                                <MetParagraph>• Contains profanity or inappropriate language</MetParagraph>
                            </Grid>
                        )}
                        {version.has_threat && (
                            <Grid item xs={12}>
                                <MetParagraph>• Contains threat/menace</MetParagraph>
                            </Grid>
                        )}
                        {version.rejected_reason_other && (
                            <Grid item xs={12}>
                                <MetParagraph>• Other: {version.rejected_reason_other}</MetParagraph>
                            </Grid>
                        )}
                    </Grid>
                )}

                {/* Staff Notes */}
                {reviewNotes.length > 0 && reviewNotes.some((n: VersionStaffNote) => n.note) && (
                    <Grid container rowSpacing={1} paddingTop={3}>
                        <Grid item xs={12}>
                            <MetLabel>Review Notes</MetLabel>
                        </Grid>
                        {reviewNotes.map((note: VersionStaffNote, index: number) => (
                            <Grid key={index} item xs={12}>
                                <Box
                                    sx={{
                                        p: 2,
                                        backgroundColor: '#f5f5f5',
                                        borderRadius: 1,
                                        border: '1px solid #e0e0e0',
                                    }}
                                >
                                    <MetParagraph>{note.note || '(empty)'}</MetParagraph>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                )}

                {internalNotes.length > 0 && internalNotes.some((n: VersionStaffNote) => n.note) && (
                    <Grid container rowSpacing={1} paddingTop={3}>
                        <Grid item xs={12}>
                            <MetLabel>Internal Note</MetLabel>
                        </Grid>
                        {internalNotes.map((note: VersionStaffNote, index: number) => (
                            <Grid key={index} item xs={12}>
                                <Box
                                    sx={{
                                        p: 2,
                                        backgroundColor: '#f5f5f5',
                                        borderRadius: 1,
                                        border: '1px solid #e0e0e0',
                                    }}
                                >
                                    <MetParagraph>{note.note || '(empty)'}</MetParagraph>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Grid>
        </MetPageGridContainer>
    );
};

export default VersionDetailView;

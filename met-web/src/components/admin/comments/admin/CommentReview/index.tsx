import { useState, useEffect } from 'react';
import {
    Grid,
    FormControl,
    RadioGroup,
    FormControlLabel,
    Radio,
    Stack,
    FormLabel,
    Divider,
    Checkbox,
    TextField,
    FormHelperText,
    Link,
    IconButton,
    Box,
    Button,
} from '@mui/material';
import { getSubmission, getSubmissionPage, getSubmissionVersions, reviewComments } from 'services/submissionService';
import { useAppDispatch, useAppTranslation } from 'hooks';
import { useParams, useNavigate } from 'react-router-dom';
import { openNotification } from 'services/notificationService/notificationSlice';
import {
    MetLabel,
    MetParagraph,
    MetPageGridContainer,
    PrimaryButton,
    SecondaryButton,
    TertiaryButton,
    MetHeader3,
    MetHeader4,
    MetSmallText,
    MetTooltip,
} from 'components/shared/common';
import { CommentStatus, COMMENTS_STATUS } from 'constants/commentStatus';
import { StaffNoteType } from 'constants/staffNoteType';
import { formatDate } from 'utils/helpers/dateHelper';
import { CommentReviewSkeleton } from './CommentReviewSkeleton';
import { createDefaultSubmission, SurveySubmission } from 'models/surveySubmission';
import { createDefaultReviewNote, createDefaultInternalNote, StaffNote } from 'models/staffNote';
import { SubmissionVersion } from 'models/submissionVersion';
import { If, Then, Else, When } from 'react-if';
import EmailPreviewModal from './emailPreview/EmailPreviewModal';
import { RejectEmailTemplate } from './emailPreview/EmailTemplates';
import EmailPreview from './emailPreview/EmailPreview';
import { Survey, createDefaultSurvey } from 'models/survey';
import { getSurvey } from 'services/surveyService';
import CommentIcon from '@mui/icons-material/Comment';
import CommentsDisabledIcon from '@mui/icons-material/CommentsDisabled';
import EditIcon from '@mui/icons-material/Edit';
import EditContactModal from './EditContactModal';
import { getSettingByKey } from 'services/settingsService';
import { SettingKey } from 'constants/settingKey';
import { ThreatContact } from 'models/threatContact';
import { getThreatContactById } from 'services/threatContactService';
import { PermissionsGate } from 'components/shared/permissionsGate';
import { USER_ROLES } from 'services/userService/constants';
import VersionHistoryDrawer from './VersionHistoryDrawer';
import { statusStyles } from 'styles/Theme';

const CommentReview = () => {
    const [submission, setSubmission] = useState<SurveySubmission>(createDefaultSubmission());
    const [review, setReview] = useState(CommentStatus.Approved);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [hasOtherReason, setHasOtherReason] = useState(false);
    const [hasPersonalInfo, setHasPersonalInfo] = useState(false);
    const [hasProfanity, setHasProfanity] = useState(false);
    const [hasThreat, setHasThreat] = useState(false);
    const [otherReason, setOtherReason] = useState('');
    const [hasError, setHasError] = useState(false);
    const [notifyEmail, setNotifyEmail] = useState(true);
    const [staffNote, setStaffNote] = useState<StaffNote[]>([]);
    const [updatedStaffNote, setUpdatedStaffNote] = useState<StaffNote[]>([]);
    const [openEmailPreview, setEmailPreview] = useState(false);
    const [survey, setSurvey] = useState<Survey>(createDefaultSurvey());
    const [isEditingThreatContact, setIsEditingThreatContact] = useState(false);
    const [threatContact, setThreatContact] = useState<ThreatContact | null>(null);
    const [nextPendingId, setNextPendingId] = useState<number | null>(null);
    const [versions, setVersions] = useState<SubmissionVersion[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<SubmissionVersion | null>(null);
    const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { t: translate } = useAppTranslation();
    const { submissionId, surveyId } = useParams();
    const reviewNotes = updatedStaffNote.filter((staffNote) => staffNote.note_type == StaffNoteType.Review);
    const internalNotes = updatedStaffNote.filter((staffNote) => staffNote.note_type == StaffNoteType.Internal);

    const MAX_OTHER_REASON_CHAR = 500;

    const getEmailPreview = () => {
        return (
            <EmailPreview survey={survey}>
                <When condition={review == CommentStatus.Rejected}>
                    <RejectEmailTemplate
                        hasPersonalInfo={hasPersonalInfo}
                        hasProfanity={hasProfanity}
                        hasThreat={hasThreat}
                        otherReason={otherReason}
                        reviewNotes={reviewNotes}
                    />
                </When>
            </EmailPreview>
        );
    };

    const fetchNextPending = async (currentId: number) => {
        try {
            const result = await getSubmissionPage({
                survey_id: Number(surveyId),
                queryParams: {
                    page: 1,
                    size: 10,
                    status: CommentStatus.Pending,
                    sort_key: 'submission.id',
                    sort_order: 'asc',
                },
            });
            const next = result.items.find((s) => Number(s.id) !== currentId);
            setNextPendingId(next?.id ?? null);
        } catch (err) {
            setNextPendingId(null);
        }
    };

    const fetchSubmission = async () => {
        try {
            if (isNaN(Number(submissionId))) {
                throw new Error();
            }
            const fetchedSubmission = await getSubmission(Number(submissionId));
            const fetchedSurvey = await getSurvey(Number(surveyId));
            setSubmission(fetchedSubmission);
            setSurvey(fetchedSurvey);
            setHasOtherReason(!!fetchedSubmission.rejected_reason_other);
            setOtherReason(fetchedSubmission.rejected_reason_other ?? '');
            setHasPersonalInfo(fetchedSubmission.has_personal_info ?? false);
            setHasProfanity(fetchedSubmission.has_profanity ?? false);
            setHasThreat(fetchedSubmission.has_threat ?? false);
            setNotifyEmail(fetchedSubmission.notify_email ?? true);
            setStaffNote(fetchedSubmission.staff_note);
            setReview(
                fetchedSubmission.comment_status_id == CommentStatus.Pending
                    ? CommentStatus.Approved
                    : fetchedSubmission.comment_status_id,
            );
            // Fetch version history
            try {
                const fetchedVersions = await getSubmissionVersions(Number(submissionId));
                setVersions(fetchedVersions);
            } catch {
                setVersions([]);
            }
            setIsLoading(false);
        } catch (error) {
            dispatch(openNotification({ severity: 'error', text: 'Error occurred while fetching comments' }));
            navigate('/');
        }
    };

    const extract_staff_note = async () => {
        setUpdatedStaffNote(
            staffNote.length !== 0 ? staffNote : [createDefaultReviewNote(), createDefaultInternalNote()],
        );
    };

    useEffect(() => {
        const currentId = Number(submissionId);
        setIsLoading(true);
        setNextPendingId(null);
        setReview(CommentStatus.Approved);
        setHasOtherReason(false);
        setOtherReason('');
        setHasPersonalInfo(false);
        setHasProfanity(false);
        setHasThreat(false);
        setNotifyEmail(true);
        setHasError(false);
        setVersions([]);
        setSelectedVersion(null);
        setVersionDrawerOpen(false);
        fetchSubmission();
        fetchNextPending(currentId);
    }, [submissionId]);

    useEffect(() => {
        extract_staff_note();
    }, [staffNote]);

    // Get current threat contact setting and the corresponding contact
    const fetchThreatContactSettings = async () => {
        const currentThreatContactSetting = await getSettingByKey(SettingKey.THREAT_CONTACT);
        if (!currentThreatContactSetting?.setting_value) return;
        const currentThreatContact = await getThreatContactById(
            parseInt(currentThreatContactSetting?.setting_value, 10),
        );
        setThreatContact(currentThreatContact);
    };

    useEffect(() => {
        fetchThreatContactSettings();
    }, []);

    const handleReviewChange = (verdict: number) => {
        setReview(verdict);
        if (review === CommentStatus.Approved) {
            setHasOtherReason(false);
            setOtherReason('');
            setHasPersonalInfo(false);
            setHasProfanity(false);
            setHasThreat(false);
            setNotifyEmail(true);
        }
    };

    const validate = (): boolean => {
        if (review == CommentStatus.Rejected) {
            if (hasOtherReason && !otherReason) {
                // Other reason is mandatory if selected
                return false;
            }
            // At least one reason is selected
            return hasOtherReason || hasPersonalInfo || hasProfanity || hasThreat;
        }
        return true;
    };
    const handleSave = async () => {
        const isValid = validate();
        setHasError(!isValid);
        if (!isValid) {
            return;
        }
        setIsSaving(true);
        try {
            await reviewComments({
                submission_id: Number(submissionId),
                status_id: review,
                has_personal_info: hasPersonalInfo,
                has_profanity: hasProfanity,
                has_threat: hasThreat,
                rejected_reason_other: otherReason,
                notify_email: notifyEmail,
                staff_note: updatedStaffNote,
            });
            setIsSaving(false);
            dispatch(openNotification({ severity: 'success', text: 'Comments successfully reviewed.' }));
            navigate(`/surveys/${submission.survey_id}/comments`);
        } catch (error) {
            dispatch(openNotification({ severity: 'error', text: 'Error occurred while sending comments review.' }));
            setIsSaving(false);
        }
    };

    const handleSaveAndNext = async () => {
        const isValid = validate();
        setHasError(!isValid);
        if (!isValid) {
            return;
        }
        setIsSaving(true);
        try {
            await reviewComments({
                submission_id: Number(submissionId),
                status_id: review,
                has_personal_info: hasPersonalInfo,
                has_profanity: hasProfanity,
                has_threat: hasThreat,
                rejected_reason_other: otherReason,
                notify_email: notifyEmail,
                staff_note: updatedStaffNote,
            });
            setIsSaving(false);
            dispatch(openNotification({ severity: 'success', text: 'Comments successfully reviewed.' }));
            navigate(`/surveys/${surveyId}/submissions/${nextPendingId}/review`);
        } catch (error) {
            dispatch(openNotification({ severity: 'error', text: 'Error occurred while sending comments review.' }));
            setIsSaving(false);
        }
    };

    const previewEmail = () => {
        setEmailPreview(true);
    };

    // The comment display information below is fetched from the first comment from the list
    // since comment status/review are being stored individually
    // These values should be exactly the same throughout the array.
    const { id, comment_status_id, reviewed_by, created_date, review_date } = submission;

    if (isLoading) {
        return <CommentReviewSkeleton />;
    }

    // If viewing a historical version, show the read-only detail view
    const viewingVersion = selectedVersion !== null;

    const handleNoteChange = (note: string, note_type: string, note_id: number) => {
        const newStaffNoteArray = [...updatedStaffNote];
        newStaffNoteArray.forEach((staffNote) => {
            if (staffNote.id === note_id && staffNote.note_type === note_type) {
                staffNote.note = note;
            }
        });
        setUpdatedStaffNote(newStaffNoteArray);
    };

    const defaultVerdict = comment_status_id !== CommentStatus.Pending ? comment_status_id : CommentStatus.Approved;
    const isResubmission = versions.length > 0 && comment_status_id === CommentStatus.Pending;

    return (
        <MetPageGridContainer>
            <EmailPreviewModal
                open={openEmailPreview}
                handleClose={() => setEmailPreview(false)}
                header={'Your comment on (Engagement name) needs to be edited'}
                renderEmail={getEmailPreview()}
            />
            <VersionHistoryDrawer
                open={versionDrawerOpen}
                onClose={() => setVersionDrawerOpen(false)}
                versions={versions}
                selectedVersion={selectedVersion}
                onSelectVersion={(v) => {
                    setSelectedVersion(v);
                    setVersionDrawerOpen(false);
                }}
            />
            <Grid
                container
                direction="row"
                padding="3em"
                justifyContent="flex-start"
                alignItems="flex-start"
                rowSpacing={4}
            >
                <Grid item xs={12}>
                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                        {/* Row 1: Info columns */}
                        <Grid container spacing={2} alignItems="center">
                            {/* Column 1: Comment ID & Comment Date */}
                            <Grid item xs={12} md={4}>
                                <Stack spacing={1}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <MetLabel>Comment ID:</MetLabel>
                                        <MetParagraph>{id}</MetParagraph>
                                    </Stack>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <MetLabel>Comment Date:</MetLabel>
                                        <MetParagraph>{formatDate(created_date)}</MetParagraph>
                                    </Stack>
                                </Stack>
                            </Grid>
                            {/* Column 2: Reviewed By & Date Reviewed */}
                            <Grid item xs={12} md={4}>
                                <Stack spacing={1}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <MetLabel>Reviewed by:</MetLabel>
                                        <MetParagraph>
                                            {viewingVersion ? selectedVersion?.reviewed_by || '' : reviewed_by}
                                        </MetParagraph>
                                    </Stack>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <MetLabel>Date Reviewed:</MetLabel>
                                        <MetParagraph>
                                            {viewingVersion
                                                ? formatDate(selectedVersion?.review_date || '')
                                                : formatDate(review_date)}
                                        </MetParagraph>
                                    </Stack>
                                </Stack>
                            </Grid>
                            {/* Column 3: Status */}
                            <Grid
                                item
                                xs={12}
                                md={4}
                                sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}
                            >
                                <Stack direction="row" spacing={1} alignItems="flex-start">
                                    <MetLabel>Status:</MetLabel>
                                    <Stack spacing={0.5} alignItems="flex-start">
                                        <Box
                                            sx={{
                                                borderRadius: '2px',
                                                border: `1px solid ${
                                                    statusStyles[
                                                        viewingVersion
                                                            ? selectedVersion?.comment_status_id ??
                                                              CommentStatus.Pending
                                                            : comment_status_id
                                                    ]?.borderColor
                                                }`,
                                                background:
                                                    statusStyles[
                                                        viewingVersion
                                                            ? selectedVersion?.comment_status_id ??
                                                              CommentStatus.Pending
                                                            : comment_status_id
                                                    ]?.background,
                                                px: 1.5,
                                                py: 0.25,
                                            }}
                                        >
                                            <MetParagraph>
                                                {viewingVersion
                                                    ? COMMENTS_STATUS[
                                                          selectedVersion?.comment_status_id as CommentStatus
                                                      ]
                                                    : COMMENTS_STATUS[comment_status_id as CommentStatus]}
                                            </MetParagraph>
                                        </Box>
                                        {!viewingVersion && isResubmission && (
                                            <Box
                                                sx={{
                                                    borderRadius: '2px',
                                                    border: `1px solid ${statusStyles.resubmitted.borderColor}`,
                                                    background: statusStyles.resubmitted.background,
                                                    px: 1.5,
                                                    py: 0.25,
                                                }}
                                            >
                                                <MetParagraph>Resubmitted</MetParagraph>
                                            </Box>
                                        )}
                                    </Stack>
                                </Stack>
                            </Grid>
                        </Grid>
                        {/* Row 2: Version buttons, right-justified, 1 rightmost */}
                        {versions.length > 0 && (
                            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
                                <Button
                                    variant={viewingVersion ? 'outlined' : 'contained'}
                                    size="small"
                                    onClick={() => setSelectedVersion(null)}
                                >
                                    Submission {versions.length + 1} (Current)
                                </Button>
                                {versions
                                    .slice()
                                    .sort((a, b) => b.version_number - a.version_number)
                                    .map((version) => (
                                        <Button
                                            key={version.id}
                                            variant={selectedVersion?.id === version.id ? 'contained' : 'outlined'}
                                            size="small"
                                            onClick={() => {
                                                setSelectedVersion(version);
                                            }}
                                        >
                                            Submission {version.version_number}
                                        </Button>
                                    ))}
                            </Stack>
                        )}
                    </Box>
                </Grid>
                <Grid container rowSpacing={2} paddingTop={5}>
                    <Grid item xs={12}>
                        <Grid xs={12} item>
                            <MetHeader3>
                                {viewingVersion
                                    ? `Comment(s) — Submission ${selectedVersion?.version_number}`
                                    : 'Comment(s)'}
                            </MetHeader3>
                        </Grid>
                    </Grid>
                    {viewingVersion
                        ? // Show historical version comments (read-only)
                          selectedVersion?.comment_json?.map((comment, idx) => (
                              <Grid key={idx} item xs={12}>
                                  <Divider />
                                  <Grid container direction="row" alignItems="flex-start" justifyContent="flex-start">
                                      <Grid item xs={1} paddingTop={3}>
                                          <CommentsDisabledIcon color="disabled" />
                                      </Grid>
                                      <Grid item xs={11}>
                                          <Grid xs={12} item paddingTop={2}>
                                              <MetLabel>{comment.component_id ?? 'Label not available.'}</MetLabel>
                                          </Grid>
                                          <Grid xs={12} item>
                                              <MetParagraph>{comment.text}</MetParagraph>
                                          </Grid>
                                      </Grid>
                                  </Grid>
                              </Grid>
                          ))
                        : // Show current submission comments
                          submission.comments?.map((comment) => {
                              return (
                                  <Grid key={comment.id} item xs={12}>
                                      <Divider />
                                      <Grid
                                          container
                                          direction="row"
                                          alignItems={'flex-start'}
                                          justifyContent="flex-start"
                                      >
                                          <Grid item xs={1} paddingTop={3}>
                                              <If condition={comment.is_displayed}>
                                                  <Then>
                                                      <Grid xs={12} item>
                                                          <MetTooltip
                                                              disableInteractive
                                                              title={'Displayed to the public'}
                                                              placement="top"
                                                              arrow
                                                          >
                                                              <span>
                                                                  <CommentIcon color="info" />
                                                              </span>
                                                          </MetTooltip>
                                                      </Grid>
                                                  </Then>
                                                  <Else>
                                                      <Grid xs={12} item>
                                                          <MetTooltip
                                                              disableInteractive
                                                              title={'Not displayed to the public'}
                                                              placement="top"
                                                              arrow
                                                          >
                                                              <span>
                                                                  <CommentsDisabledIcon color="info" />
                                                              </span>
                                                          </MetTooltip>
                                                      </Grid>
                                                  </Else>
                                              </If>
                                          </Grid>
                                          <Grid item xs={11}>
                                              <Grid xs={12} item paddingTop={2}>
                                                  <MetLabel>{comment.label ?? 'Label not available.'}</MetLabel>
                                              </Grid>
                                              <Grid xs={12} item>
                                                  <MetParagraph>{comment.text}</MetParagraph>
                                              </Grid>
                                          </Grid>
                                      </Grid>
                                  </Grid>
                              );
                          })}
                    <Grid item xs={12}>
                        <Divider />
                    </Grid>
                </Grid>
                <If condition={viewingVersion}>
                    <Then>
                        {/* Read-only approval showing what was selected for this version */}
                        <Grid item xs={12} sx={{ opacity: 0.6 }}>
                            <FormControl disabled>
                                <FormLabel id="controlled-radio-buttons-group-readonly">
                                    <MetHeader3 sx={{ color: '#494949' }}>Comments Approval</MetHeader3>
                                </FormLabel>
                                <RadioGroup value={selectedVersion?.comment_status_id}>
                                    <FormControlLabel
                                        value={CommentStatus.Approved}
                                        control={<Radio />}
                                        label={<MetParagraph>Approve</MetParagraph>}
                                    />
                                    <FormControlLabel
                                        value={CommentStatus.Rejected}
                                        control={<Radio />}
                                        label={<MetParagraph>Reject</MetParagraph>}
                                    />
                                    <FormControlLabel
                                        value={CommentStatus.NeedsFurtherReview}
                                        control={<Radio />}
                                        label={<MetParagraph>Needs further review</MetParagraph>}
                                    />
                                </RadioGroup>
                            </FormControl>
                        </Grid>
                        {selectedVersion?.comment_status_id === CommentStatus.Rejected && (
                            <Grid item xs={12} sx={{ opacity: 0.6 }}>
                                <FormControl disabled>
                                    <FormLabel id="controlled-checkbox-group-readonly">
                                        <MetHeader4 sx={{ color: '#494949' }}>Reason for Rejection</MetHeader4>
                                    </FormLabel>
                                    <FormControlLabel
                                        label={<MetParagraph>Contains personal information</MetParagraph>}
                                        control={<Checkbox checked={selectedVersion?.has_personal_info || false} />}
                                    />
                                    <FormControlLabel
                                        label={
                                            <MetParagraph>Contains profanity or inappropriate language</MetParagraph>
                                        }
                                        control={<Checkbox checked={selectedVersion?.has_profanity || false} />}
                                    />
                                    <FormControlLabel
                                        label={<MetParagraph>Contains threat/menace</MetParagraph>}
                                        control={<Checkbox checked={selectedVersion?.has_threat || false} />}
                                    />
                                    {selectedVersion?.rejected_reason_other && (
                                        <TextField
                                            label="Other"
                                            value={selectedVersion.rejected_reason_other}
                                            disabled
                                            fullWidth
                                            size="small"
                                            sx={{ mt: 1 }}
                                        />
                                    )}
                                </FormControl>
                            </Grid>
                        )}
                        {/* Historical Review Notes */}
                        {selectedVersion?.staff_note_json && selectedVersion.staff_note_json.length > 0 && (
                            <Grid item xs={12} sx={{ opacity: 0.6 }}>
                                {selectedVersion.staff_note_json.filter(
                                    (note) => note.note_type === StaffNoteType.Review,
                                ).length > 0 && (
                                    <>
                                        <MetParagraph sx={{ fontWeight: 'bold', color: '#494949', mt: 2 }}>
                                            Review Notes
                                        </MetParagraph>
                                        {selectedVersion.staff_note_json
                                            .filter((note) => note.note_type === StaffNoteType.Review)
                                            .map((note, idx) => (
                                                <TextField
                                                    key={idx}
                                                    value={note.note}
                                                    fullWidth
                                                    multiline
                                                    rows={4}
                                                    disabled
                                                    sx={{ mt: 1 }}
                                                />
                                            ))}
                                    </>
                                )}
                                {selectedVersion.staff_note_json.filter(
                                    (note) => note.note_type === StaffNoteType.Internal,
                                ).length > 0 && (
                                    <>
                                        <MetLabel sx={{ mt: 2 }}>Internal Note</MetLabel>
                                        {selectedVersion.staff_note_json
                                            .filter((note) => note.note_type === StaffNoteType.Internal)
                                            .map((note, idx) => (
                                                <TextField
                                                    key={idx}
                                                    value={note.note}
                                                    fullWidth
                                                    multiline
                                                    rows={4}
                                                    disabled
                                                    sx={{ mt: 1 }}
                                                />
                                            ))}
                                    </>
                                )}
                            </Grid>
                        )}
                    </Then>
                    <Else>
                        <Grid item xs={12}>
                            <FormControl>
                                <FormLabel id="controlled-radio-buttons-group">
                                    <MetHeader3 sx={{ color: '#494949' }}>Comments Approval</MetHeader3>
                                </FormLabel>
                                <RadioGroup
                                    defaultValue={defaultVerdict}
                                    onChange={(e) => handleReviewChange(Number(e.target.value))}
                                >
                                    <FormControlLabel
                                        value={CommentStatus.Approved}
                                        control={<Radio />}
                                        label={<MetParagraph>Approve</MetParagraph>}
                                    />
                                    <FormControlLabel
                                        value={CommentStatus.Rejected}
                                        control={<Radio />}
                                        label={<MetParagraph>Reject</MetParagraph>}
                                    />
                                    <FormControlLabel
                                        value={CommentStatus.NeedsFurtherReview}
                                        control={<Radio />}
                                        label={<MetParagraph>Needs further review</MetParagraph>}
                                    />
                                </RadioGroup>
                            </FormControl>
                        </Grid>
                        <When condition={review == CommentStatus.Rejected}>
                            <Grid item xs={12}>
                                <FormControl>
                                    <FormLabel id="controlled-checkbox-group">
                                        <MetHeader4 sx={{ color: '#494949' }}>Reason for Rejection</MetHeader4>
                                    </FormLabel>
                                    <FormControlLabel
                                        label={<MetParagraph>Contains personal information</MetParagraph>}
                                        control={
                                            <Checkbox
                                                checked={hasPersonalInfo}
                                                onChange={(event, checked) => setHasPersonalInfo(checked)}
                                            />
                                        }
                                    />
                                    <FormControlLabel
                                        label={
                                            <MetParagraph>Contains profanity or inappropriate language</MetParagraph>
                                        }
                                        control={
                                            <Checkbox
                                                checked={hasProfanity}
                                                onChange={(event, checked) => setHasProfanity(checked)}
                                            />
                                        }
                                    />
                                    <FormControlLabel
                                        label={<MetParagraph>Contains threat/menace</MetParagraph>}
                                        control={
                                            <Checkbox
                                                checked={hasThreat}
                                                onChange={(event, checked) => setHasThreat(checked)}
                                            />
                                        }
                                    />
                                    <Grid
                                        container
                                        direction="row"
                                        alignItems="center"
                                        spacing={1}
                                        sx={{ marginLeft: '3em', mt: '-1em' }}
                                    >
                                        <Grid item>
                                            <MetSmallText bold color="#d32f2f">
                                                {translate('comment.admin.review.threatTextOne')}{' '}
                                                {threatContact?.first_name} {threatContact?.last_name}{' '}
                                                {translate('comment.admin.review.threatTextTwo')}{' '}
                                                <Link href={`mailto:${threatContact?.email}`}>
                                                    {threatContact?.email}
                                                </Link>
                                            </MetSmallText>
                                        </Grid>
                                        <PermissionsGate
                                            scopes={[USER_ROLES.CREATE_ENGAGEMENT]}
                                            errorProps={{ hidden: true }}
                                        >
                                            <Grid item>
                                                <IconButton
                                                    size="small"
                                                    color="primary"
                                                    onClick={() => setIsEditingThreatContact(true)}
                                                    data-testid="survey-widget/edit"
                                                    sx={{ padding: 0.5 }}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Grid>
                                        </PermissionsGate>
                                    </Grid>
                                    <EditContactModal
                                        isOpen={isEditingThreatContact}
                                        setIsOpen={setIsEditingThreatContact}
                                        onSaveCallback={fetchThreatContactSettings}
                                    />
                                    <FormControlLabel
                                        label={<MetParagraph sx={{ color: '#494949' }}>Other</MetParagraph>}
                                        control={
                                            <Checkbox
                                                checked={hasOtherReason}
                                                onChange={(event, checked) => {
                                                    setHasOtherReason(checked);
                                                    if (!checked) {
                                                        setOtherReason('');
                                                    }
                                                }}
                                            />
                                        }
                                    />
                                    <MetParagraph sx={{ marginLeft: '3em', color: '#707070', fontSize: '13px' }}>
                                        This will be inserted in the email sent to the respondent:
                                        <MetParagraph sx={{ fontStyle: 'italic', color: '#707070', fontSize: '13px' }}>
                                            We have reviewed your feedback and can't accept it for the following
                                            reason(s): - Your feedback contains "other"
                                        </MetParagraph>
                                    </MetParagraph>
                                    <TextField
                                        disabled={!hasOtherReason}
                                        value={otherReason}
                                        sx={{ marginLeft: '2em' }}
                                        FormHelperTextProps={{ error: true }}
                                        onChange={(event) => setOtherReason(event.target.value)}
                                        inputProps={{ maxLength: MAX_OTHER_REASON_CHAR }}
                                        multiline
                                    />
                                    <br />
                                    <MetParagraph sx={{ fontWeight: 'bold', color: '#494949' }}>
                                        Review Notes
                                    </MetParagraph>
                                    <MetParagraph sx={{ color: '#707070', fontSize: '13px' }}>
                                        This note will be inserted in the email sent to the respondent to help them
                                        understand what needs to be edited for their comment(s) to be approved.
                                    </MetParagraph>
                                    {reviewNotes.map((staffNote) => {
                                        return (
                                            <TextField
                                                value={staffNote.note}
                                                key={staffNote.note_type}
                                                fullWidth
                                                multiline={true}
                                                rows={4}
                                                FormHelperTextProps={{ error: true }}
                                                onChange={(event) => {
                                                    handleNoteChange(
                                                        event.target.value,
                                                        staffNote.note_type,
                                                        staffNote.id,
                                                    );
                                                }}
                                            />
                                        );
                                    })}

                                    <When condition={review == CommentStatus.Rejected && notifyEmail && !hasThreat}>
                                        <Grid
                                            item
                                            xs={12}
                                            sx={{ m: 1 }}
                                            container
                                            alignItems="flex-end"
                                            justifyContent="flex-end"
                                        >
                                            <SecondaryButton onClick={previewEmail}>{'Preview Email'}</SecondaryButton>
                                        </Grid>
                                    </When>
                                    <br />
                                    <MetLabel>Internal Note</MetLabel>
                                    {internalNotes.map((staffNote) => {
                                        return (
                                            <TextField
                                                value={staffNote.note}
                                                key={staffNote.note_type}
                                                fullWidth
                                                multiline={true}
                                                rows={4}
                                                FormHelperTextProps={{ error: true }}
                                                onChange={(event) => {
                                                    handleNoteChange(
                                                        event.target.value,
                                                        staffNote.note_type,
                                                        staffNote.id,
                                                    );
                                                }}
                                            />
                                        );
                                    })}
                                    <br />
                                    <MetParagraph>
                                        Clicking the "Save" button will trigger an automatic email to be sent to the
                                        person who made this comment. They will have the option to edit and re-submit
                                        their comment. The edited comment will have to be approved before it is
                                        published.
                                    </MetParagraph>
                                    <br />
                                    <FormControlLabel
                                        label={
                                            <MetParagraph>
                                                Don't send this email to the person who commented.
                                            </MetParagraph>
                                        }
                                        control={
                                            <Checkbox
                                                checked={notifyEmail === true ? false : true}
                                                onChange={(event, checked) =>
                                                    setNotifyEmail(checked === true ? false : true)
                                                }
                                            />
                                        }
                                    />
                                    <br />
                                    <FormHelperText error={true}>
                                        {hasError
                                            ? 'Please enter at least one reason for rejecting the comment(s).'
                                            : ''}
                                    </FormHelperText>
                                </FormControl>
                            </Grid>
                        </When>
                        <When condition={review !== CommentStatus.Rejected}>
                            <Grid item xs={12}>
                                <MetLabel>Internal Note</MetLabel>
                                {internalNotes.map((staffNote) => {
                                    return (
                                        <TextField
                                            value={staffNote.note}
                                            key={staffNote.note_type}
                                            fullWidth
                                            multiline={true}
                                            rows={4}
                                            FormHelperTextProps={{ error: true }}
                                            onChange={(event) => {
                                                handleNoteChange(event.target.value, staffNote.note_type, staffNote.id);
                                            }}
                                        />
                                    );
                                })}
                            </Grid>
                        </When>
                        <Grid item xs={12}>
                            <Stack direction="row" spacing={2}>
                                {nextPendingId !== null ? (
                                    <>
                                        <PrimaryButton loading={isSaving} onClick={handleSaveAndNext}>
                                            {'Save & Review Next'}
                                        </PrimaryButton>
                                        <SecondaryButton loading={isSaving} onClick={handleSave}>
                                            {'Save & Close'}
                                        </SecondaryButton>
                                        <TertiaryButton onClick={() => navigate(`/surveys/${surveyId}/comments`)}>
                                            {'Cancel'}
                                        </TertiaryButton>
                                    </>
                                ) : (
                                    <>
                                        <PrimaryButton loading={isSaving} onClick={handleSave}>
                                            {'Save & Close'}
                                        </PrimaryButton>
                                        <SecondaryButton onClick={() => navigate(`/surveys/${surveyId}/comments`)}>
                                            {'Cancel'}
                                        </SecondaryButton>
                                    </>
                                )}
                            </Stack>
                        </Grid>
                    </Else>
                </If>
            </Grid>
        </MetPageGridContainer>
    );
};

export default CommentReview;

import { FC } from 'react';
import { Grid, Chip, Divider, Drawer, IconButton, Typography, Box, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import { SubmissionVersion } from 'models/submissionVersion';
import { CommentStatus, COMMENTS_STATUS } from 'constants/commentStatus';
import { formatDate } from 'utils/helpers/dateHelper';
import { MetLabel, MetParagraph } from 'components/shared/common';

interface VersionHistoryDrawerProps {
    open: boolean;
    onClose: () => void;
    versions: SubmissionVersion[];
    selectedVersion: SubmissionVersion | null;
    onSelectVersion: (version: SubmissionVersion) => void;
}

const VersionHistoryDrawer: FC<VersionHistoryDrawerProps> = ({
    open,
    onClose,
    versions,
    selectedVersion,
    onSelectVersion,
}) => {
    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{ sx: { width: { xs: '100%', sm: 500 }, p: 3 } }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <HistoryIcon color="primary" />
                    <Typography variant="h6" fontWeight="bold">
                        Version History
                    </Typography>
                </Stack>
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Box>
            <Divider sx={{ mb: 2 }} />

            {versions.length === 0 ? (
                <MetParagraph sx={{ color: '#707070' }}>No previous versions available.</MetParagraph>
            ) : (
                versions.map((version) => (
                    <VersionCard
                        key={version.id}
                        version={version}
                        isSelected={selectedVersion?.id === version.id}
                        onClick={() => onSelectVersion(version)}
                    />
                ))
            )}
        </Drawer>
    );
};

interface VersionCardProps {
    version: SubmissionVersion;
    isSelected: boolean;
    onClick: () => void;
}

const VersionCard: FC<VersionCardProps> = ({ version, isSelected, onClick }) => {
    const statusLabel = COMMENTS_STATUS[version.comment_status_id as CommentStatus] ?? 'Unknown';
    const isRejected = version.comment_status_id === CommentStatus.Rejected;

    return (
        <Box
            onClick={onClick}
            sx={{
                p: 2,
                mb: 1.5,
                border: '1px solid',
                borderColor: isSelected ? 'primary.main' : '#e0e0e0',
                borderRadius: 1,
                cursor: 'pointer',
                backgroundColor: isSelected ? 'primary.light' : 'transparent',
                '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: isSelected ? 'primary.light' : '#f5f5f5',
                },
                transition: 'all 0.15s ease-in-out',
            }}
        >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                    Version {version.version_number}
                </Typography>
                <Chip
                    label={statusLabel}
                    size="small"
                    color={isRejected ? 'error' : 'default'}
                    variant={isRejected ? 'filled' : 'outlined'}
                />
            </Stack>
            <Grid container spacing={1}>
                <Grid item xs={6}>
                    <MetLabel sx={{ fontSize: '12px' }}>Reviewed by:</MetLabel>
                    <MetParagraph sx={{ fontSize: '13px' }}>{version.reviewed_by || '—'}</MetParagraph>
                </Grid>
                <Grid item xs={6}>
                    <MetLabel sx={{ fontSize: '12px' }}>Date Reviewed:</MetLabel>
                    <MetParagraph sx={{ fontSize: '13px' }}>
                        {version.review_date ? formatDate(version.review_date) : '—'}
                    </MetParagraph>
                </Grid>
            </Grid>
        </Box>
    );
};

export default VersionHistoryDrawer;

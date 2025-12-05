import React from 'react';
import { Modal, Paper, Grid, Stack } from '@mui/material';
import { PrimaryButton, SecondaryButton } from 'components/shared/common';
import { Engagement } from 'models/engagement';
import { deleteEngagement } from 'services/engagementService';

interface DeleteEngagementModalProps {
    open: boolean;
    onClose: () => void;
    onDelete: () => void;
    engagement: Engagement;
}

export const DeleteEngagementModal: React.FC<DeleteEngagementModalProps> = ({
    open,
    onClose,
    onDelete,
    engagement,
}) => {
    const [isDeleting, setIsDeleting] = React.useState(false);

    const handleClose = () => {
        onClose();
    };

    const onDeleteHandler = async () => {
        try {
            setIsDeleting(true);
            await deleteEngagement(engagement.id);
            setIsDeleting(false);
            onDelete();
            handleClose();
        } catch (error) {
            setIsDeleting(false);
            console.error('Failed to delete engagement:', error);
        }
    };

    return (
        <Modal open={open} onClose={handleClose}>
            <Paper
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    p: 4,
                    minWidth: 400,
                }}
            >
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <h2>Delete Engagement</h2>
                    </Grid>

                    <Grid item xs={12}>
                        This will permanently delete <strong>{engagement.name}</strong> and cannot be undone. Do you
                        want to continue?
                    </Grid>

                    <Grid item xs={12}>
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <SecondaryButton type="button" onClick={handleClose}>
                                Cancel
                            </SecondaryButton>
                            <PrimaryButton type="button" onClick={onDeleteHandler} disabled={isDeleting}>
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </PrimaryButton>
                        </Stack>
                    </Grid>
                </Grid>
            </Paper>
        </Modal>
    );
};

import React from 'react';
import { Modal, Paper, Grid, Stack } from '@mui/material';
import { deleteSurvey } from 'services/surveyService';
import { Survey } from 'models/survey';
import { PrimaryButton, SecondaryButton } from 'components/shared/common';

interface DeleteSurveyModalProps {
    open: boolean;
    onClose: () => void;
    onDelete: () => void;
    survey: Survey;
}

export const DeleteSurveyModal: React.FC<DeleteSurveyModalProps> = ({ open, onClose, onDelete, survey }) => {
    const [isDeleting, setIsDeleting] = React.useState(false);

    const handleClose = () => {
        onClose();
    };

    const onDeleteHandler = async () => {
        try {
            setIsDeleting(true);
            await deleteSurvey(survey.id);
            setIsDeleting(false);
            onDelete();
            handleClose();
        } catch (error) {
            setIsDeleting(false);
            console.error('Failed to delete survey:', error);
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
                        <h2>Delete Survey</h2>
                    </Grid>

                    <Grid item xs={12}>
                        This will permanently delete <strong>{survey.name}</strong> and cannot be undone. Do you want to
                        continue?
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

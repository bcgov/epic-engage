import React from 'react';
import { Grid, Modal } from '@mui/material';
import { PrimaryButton, modalStyle } from 'components/shared/common';

type EmailModal = {
    open: boolean;
    header: string;
    renderEmail: React.ReactNode;
    handleClose: () => void;
};

const EmailPreviewModal = ({ open, header, renderEmail, handleClose }: EmailModal) => {
    return (
        <Modal open={open} onClose={() => handleClose()}>
            <Grid
                container
                direction="column"
                alignItems="center"
                wrap="nowrap"
                sx={{
                    ...modalStyle,
                    display: 'flex',
                    overflowY: 'hidden',
                    pt: 4,
                    pb: 4,
                    px: 3,
                }}
            >
                <Grid
                    item
                    sx={{
                        width: '100%',
                        flex: '1 1 auto',
                        minHeight: 0,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                    }}
                >
                    {renderEmail}
                </Grid>
                <Grid item sx={{ flexShrink: 0, pt: 4 }}>
                    <PrimaryButton onClick={() => handleClose()}>Close Preview</PrimaryButton>
                </Grid>
            </Grid>
        </Modal>
    );
};

export default EmailPreviewModal;

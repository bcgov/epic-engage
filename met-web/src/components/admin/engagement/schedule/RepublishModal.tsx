import React, { useContext, useState } from 'react';
import { Grid, Stack, Modal } from '@mui/material';
import { modalStyle, PrimaryButton, SecondaryButton, MetHeader1, MetBody } from 'components/shared/common';
import { EngagementStatus } from 'constants/engagementStatus';
import { EngagementViewContext } from 'components/public/engagement/view/EngagementViewContext';

interface RepublishModalProps {
    open: boolean;
    setModalOpen: (open: boolean) => void;
}

const RepublishModal = ({ open, setModalOpen }: RepublishModalProps) => {
    const { savedEngagement, republishEngagement } = useContext(EngagementViewContext);
    const [isRepublishing, setIsRepublishing] = useState(false);

    const handleRepublishEngagement = async () => {
        try {
            setIsRepublishing(true);
            await republishEngagement({ id: savedEngagement.id, status_id: EngagementStatus.Published });
            setIsRepublishing(false);
            setModalOpen(false);
        } catch (error) {
            setIsRepublishing(false);
            setModalOpen(false);
        }
    };

    return (
        <Modal open={open} onClose={() => setModalOpen(false)}>
            <Grid
                data-testid={'republish-modal'}
                container
                direction="row"
                justifyContent="flex-start"
                alignItems="space-between"
                sx={{ ...modalStyle }}
                rowSpacing={2}
            >
                <Grid container direction="row" item xs={12}>
                    <Grid item xs={12}>
                        <MetHeader1 bold sx={{ mb: 2 }}>
                            Re-publish Engagement
                        </MetHeader1>
                    </Grid>
                </Grid>
                <Grid container direction="row" item xs={12}>
                    <Grid item xs={12}>
                        <MetBody sx={{ mb: 1 }}>This Engagement will be re-published:</MetBody>
                    </Grid>
                    <Grid item xs={12}>
                        <ul>
                            <li>
                                <MetBody>The engagement card will reappear on the home page.</MetBody>
                            </li>
                            <li>
                                <MetBody>The engagement page and survey will be visible to the public again.</MetBody>
                            </li>
                        </ul>
                    </Grid>
                    <Grid
                        item
                        container
                        xs={12}
                        direction="row"
                        justifyContent="flex-end"
                        spacing={1}
                        sx={{ mt: '1em' }}
                    >
                        <Stack
                            direction={{ md: 'column-reverse', lg: 'row' }}
                            spacing={1}
                            width="100%"
                            justifyContent="flex-end"
                        >
                            <SecondaryButton onClick={() => setModalOpen(false)}>Cancel</SecondaryButton>
                            <PrimaryButton
                                type="submit"
                                variant={'contained'}
                                loading={isRepublishing}
                                onClick={handleRepublishEngagement}
                            >
                                Submit
                            </PrimaryButton>
                        </Stack>
                    </Grid>
                </Grid>
            </Grid>
        </Modal>
    );
};

export default RepublishModal;

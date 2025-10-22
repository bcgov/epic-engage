import React, { useMemo } from 'react';
import { MenuItem, Select } from '@mui/material';
import { useAppDispatch, useAppSelector } from 'hooks';
import { Palette } from 'styles/Theme';
import { openNotification } from 'services/notificationService/notificationSlice';
import { openNotificationModal } from 'services/notificationModalService/notificationModalSlice';
import { ImageInfo } from 'models/image';
import { deleteImage, updateImage } from 'services/imageService';
import { USER_ROLES } from 'services/userService/constants';

interface ImageInfoActionDropDownItem {
    value: number;
    label: string;
    action?: () => void;
    condition?: boolean;
}
export const ImageInfoActionsDropdown = ({ imageInfo, reload }: { imageInfo: ImageInfo; reload: () => void }) => {
    const dispatch = useAppDispatch();
    const isArchived = imageInfo.archived;
    const { roles } = useAppSelector((state) => state.user);

    const authorized = roles.includes(USER_ROLES.CREATE_IMAGES);

    const archiveImage = async () => {
        try {
            await updateImage(imageInfo.id, { archived: true });
            dispatch(openNotification({ severity: 'success', text: 'Image has been archived.' }));
            reload();
        } catch (error) {
            dispatch(openNotification({ severity: 'error', text: 'Error occurred while archiving image.' }));
        }
    };

    const removeImage = async () => {
        dispatch(
            openNotificationModal({
                open: true,
                data: {
                    header: 'Delete Image',
                    subText: [
                        {
                            text: 'This image will be deleted from the Image URL Generator gallery but will remain visible in the engagement(s) it has been added to.',
                        },
                        { text: 'Do you want to delete this image from the gallery?', bold: true },
                    ],
                    handleConfirm: async () => {
                        try {
                            await deleteImage(imageInfo.id);
                            dispatch(openNotification({ severity: 'success', text: 'Image has been deleted.' }));
                            reload();
                        } catch (error) {
                            dispatch(
                                openNotification({
                                    severity: 'error',
                                    text: 'Error occurred while deleting image.',
                                }),
                            );
                        }
                    },
                },
                type: 'confirm',
            }),
        );
    };

    const ITEMS: ImageInfoActionDropDownItem[] = useMemo(
        () => [
            {
                value: 1,
                label: 'Archive',
                action: () => {
                    archiveImage();
                },
                condition: authorized && !isArchived,
            },
            {
                value: 2,
                label: 'Delete Image',
                action: () => {
                    removeImage();
                },
                condition: authorized,
            },
        ],
        [imageInfo.id],
    );

    return (
        <Select
            id={`action-drop-down-${imageInfo.id}`}
            value={0}
            fullWidth
            size="small"
            sx={{ backgroundColor: 'white', color: Palette.info.main }}
        >
            <MenuItem value={0} sx={{ fontStyle: 'italic', height: '2em' }} color="info" disabled>
                {'(Select One)'}
            </MenuItem>
            {ITEMS.filter((item) => item.condition).map((item) => (
                <MenuItem key={item.value} value={item.value} onClick={item.action}>
                    {item.label}
                </MenuItem>
            ))}
        </Select>
    );
};

export type EngagementFormTabValues = 'details' | 'settings' | 'User Management' | 'links';

export const ENGAGEMENT_FORM_TABS: { [x: string]: EngagementFormTabValues } = {
    DETAILS: 'details',
    SETTINGS: 'settings',
    USER_MANAGEMENT: 'User Management',
    LINKS: 'links',
};

export const ENGAGEMENT_UPLOADER_HEIGHT = '360px';
export const ENGAGEMENT_CROPPER_ASPECT_RATIO = 1920 / 700;
export const ENGAGEMENT_CROPPER_TEXT =
    'The image will be cropped at the correct ratio to display as a banner on MET. You can zoom in or out and move the image around. Please note that part of the image could be hidden depending on the display size.';

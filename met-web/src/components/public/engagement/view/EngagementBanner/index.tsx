import React, { useContext } from 'react';
import { EngagementViewContext } from '../EngagementViewContext';
import { useAppSelector } from 'hooks';
import { BannerSection } from './BannerSection';

export const EngagementBanner = () => {
    const { isEngagementLoading, savedEngagement, mockStatus } = useContext(EngagementViewContext);
    const isLoggedIn = useAppSelector((state) => state.user.authentication.authenticated);

    return (
        <BannerSection
            isEngagementLoading={isEngagementLoading}
            savedEngagement={savedEngagement}
            mockStatus={mockStatus}
            isLoggedIn={isLoggedIn}
        />
    );
};

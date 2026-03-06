import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from 'services/penguinAnalytics';

const PageViewTracker = () => {
    const location = useLocation();
    useEffect(() => {
        try {
            window.snowplow('trackPageView');
        } catch (error) {
            console.log(error);
        }

        analyticsService.page(location.pathname + location.search);
    }, [location]);

    return null;
};

export default PageViewTracker;

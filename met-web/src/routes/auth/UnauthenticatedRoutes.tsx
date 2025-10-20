import React from 'react';
import { Route, Routes } from 'react-router-dom';
import EngagementComments from 'components/engagement/comment';
import EngagementView from 'components/engagement/view';
import ManageSubscription from 'components/engagement/view/widgets/Subscribe/ManageSubscription';
import Landing from 'components/landing';
import PublicDashboard from 'components/publicDashboard';
import { FormCAC } from 'components/FormCAC';
import SubmitSurvey from 'components/survey/submit';
import EditSurvey from 'components/survey/edit';
import { ScrollToTop } from 'routes';
import { NotAvailable } from 'routes';
import { NotFound } from 'routes';
import { RedirectLogin } from './RedirectLogin';

const UnauthenticatedRoutes = () => {
    return (
        <>
            <ScrollToTop />
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route
                    path="/engagements/:engagementId/:subscriptionStatus/:scriptionKey"
                    element={<ManageSubscription />}
                />
                <Route path="/engagements/:engagementId/view" element={<EngagementView />} />
                <Route path="/:slug" element={<EngagementView />} />
                <Route path="/engagements/:engagementId/dashboard/:dashboardType" element={<PublicDashboard />} />
                <Route path="/:slug/dashboard/:dashboardType" element={<PublicDashboard />} />
                <Route path="/engagements/:engagementId/comments/:dashboardType" element={<EngagementComments />} />
                <Route path="/:slug/comments/:dashboardType" element={<EngagementComments />} />
                <Route path="/engagements/:engagementId/edit/:token" element={<EditSurvey />} />
                <Route path="/:slug/edit/:token" element={<EditSurvey />} />
                <Route path="/surveys/submit/:surveyId/:token" element={<SubmitSurvey />} />
                <Route path="/engagements/:engagementId/cacform/:widgetId" element={<FormCAC />} />
                <Route path="/engagements/create/form" element={<RedirectLogin />} />
                <Route path="*" element={<NotFound />} />
                <Route path="/not-found" element={<NotFound />} />
                <Route path="/not-available" element={<NotAvailable />} />
            </Routes>
        </>
    );
};

export default UnauthenticatedRoutes;

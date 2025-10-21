import React from 'react';
import { Route, Routes } from 'react-router-dom';
import NotFound from '../status/NotFound';
import EngagementForm from 'components/admin/engagement/form';
import EngagementListing from 'components/admin/engagement/listing';
import EngagementView from 'components/public/engagement/view';
import SurveyListing from 'components/admin/survey/listing';
import CreateSurvey from 'components/admin/survey/create';
import SurveyFormBuilder from 'components/admin/survey/building';
import SubmitSurvey from 'components/public/survey/submit';
import CommentReview from 'components/admin/comments/admin/CommentReview';
import CommentReviewListing from 'components/admin/comments/admin/SubmissionListing';
import CommentTextListing from 'components/admin/comments/admin/CommentTextListing';
import PublicDashboard from 'components/public/dashboard';
import EngagementComments from 'components/public/engagement/comments';
import { UnderConstruction } from 'routes';
import FeedbackListing from 'components/admin/feedback/FeedbackListing';
import UserManagementListing from 'components/admin/userManagement/listing';
import AdminDashboard from 'components/admin/dashboard';
import { Unauthorized } from 'routes';
import AuthGate from './AuthGate';
import { USER_ROLES } from 'services/userService/constants';
import UserProfile from 'components/admin/userManagement/userDetails';
import { ScrollToTop } from 'routes';
import ReportSettings from 'components/admin/survey/report';
import { FormioListener } from 'routes';
import Images from 'components/admin/imageManagement/ImageListing';

const AuthenticatedRoutes = () => {
    return (
        <>
            <ScrollToTop />
            <FormioListener />
            <Routes>
                <Route path="/" element={<AdminDashboard />} />
                <Route path="/engagements" element={<EngagementListing />} />
                <Route path="/surveys" element={<SurveyListing />} />
                <Route path="/surveys/create" element={<CreateSurvey />} />
                <Route path="/surveys/:surveyId/build" element={<SurveyFormBuilder />} />
                <Route path="/surveys/:surveyId/submit" element={<SubmitSurvey />} />
                <Route path="/surveys/:surveyId/report" element={<ReportSettings />} />
                <Route element={<AuthGate allowedRoles={[USER_ROLES.VIEW_APPROVED_COMMENTS]} />}>
                    <Route path="/surveys/:surveyId/comments" element={<CommentReviewListing />} />
                </Route>
                <Route element={<AuthGate allowedRoles={[USER_ROLES.VIEW_APPROVED_COMMENTS]} />}>
                    <Route path="/surveys/:surveyId/comments/all" element={<CommentTextListing />} />
                </Route>
                <Route element={<AuthGate allowedRoles={[USER_ROLES.REVIEW_COMMENTS]} />}>
                    <Route path="/surveys/:surveyId/submissions/:submissionId/review" element={<CommentReview />} />
                </Route>
                <Route element={<AuthGate allowedRoles={[USER_ROLES.CREATE_ENGAGEMENT]} />}>
                    <Route path="/engagements/create/form" element={<EngagementForm />} />
                </Route>
                <Route element={<AuthGate allowedRoles={[USER_ROLES.EDIT_ENGAGEMENT]} />}>
                    <Route path="/engagements/:engagementId/form" element={<EngagementForm />} />
                </Route>
                <Route path="/engagements/:engagementId/view" element={<EngagementView />} />
                <Route path="/:slug" element={<EngagementView />} />
                <Route path="/engagements/:engagementId/comments/:dashboardType" element={<EngagementComments />} />
                <Route path="/:slug/dashboard/:dashboardType" element={<PublicDashboard />} />
                <Route path="/engagements/:engagementId/dashboard/:dashboardType" element={<PublicDashboard />} />
                <Route path="/:slug/comments/:dashboardType" element={<EngagementComments />} />
                <Route element={<AuthGate allowedRoles={[USER_ROLES.VIEW_FEEDBACKS]} />}>
                    <Route path="/feedback" element={<FeedbackListing />} />
                </Route>
                <Route path="/calendar" element={<UnderConstruction />} />
                <Route path="/reporting" element={<UnderConstruction />} />
                <Route element={<AuthGate allowedRoles={[USER_ROLES.VIEW_USERS]} />}>
                    <Route path="/usermanagement" element={<UserManagementListing />} />
                </Route>
                <Route element={<AuthGate allowedRoles={[USER_ROLES.VIEW_USERS]} />}>
                    <Route path="/usermanagement/:userId/details" element={<UserProfile />} />
                </Route>
                <Route element={<AuthGate allowedRoles={[USER_ROLES.CREATE_IMAGES]} />}>
                    <Route path="/images" element={<Images />} />
                </Route>
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </>
    );
};

export default AuthenticatedRoutes;

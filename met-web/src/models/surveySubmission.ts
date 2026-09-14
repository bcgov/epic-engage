import { Comment } from './comment';
import { StaffNote } from './staffNote';

export interface SurveySubmission {
    id: number;
    survey_id: number;
    submission_json: unknown;
    created_date: string;
    reviewed_by: string;
    review_date: string;
    comment_status_id: number;
    has_personal_info?: boolean;
    has_profanity?: boolean;
    has_threat?: boolean;
    rejected_reason_other?: string;
    notify_email?: boolean;
    is_resubmission?: boolean;
    comments?: Comment[];
    staff_note: StaffNote[];
    engagement_id: number;
}

// What GET /submissions/survey/<id> actually returns. Comments are optional because only
// the comment-text screen asks for them, with include_comments.
export interface SubmissionListItem {
    id: number;
    survey_id: number;
    engagement_id: number;
    created_date: string;
    reviewed_by: string;
    review_date: string;
    comment_status_id: number;
    is_resubmission?: boolean;
    comments?: Comment[];
}

export interface PublicSubmission {
    id: number;
    engagement_id: number;
    comments: Comment[];
}
export const createDefaultSubmission = (): SurveySubmission => {
    return {
        id: 0,
        submission_json: {},
        survey_id: 0,
        created_date: '',
        review_date: '',
        reviewed_by: '',
        comment_status_id: 1,
        staff_note: [],
        engagement_id: 0,
    };
};

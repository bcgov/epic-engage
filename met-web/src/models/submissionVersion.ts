export interface SubmissionVersion {
    id: number;
    submission_id: number;
    version_number: number;
    comment_json: VersionComment[];
    comment_status_id: number;
    reviewed_by: string;
    review_date: string;
    has_personal_info: boolean;
    has_profanity: boolean;
    has_threat: boolean;
    rejected_reason_other: string;
    notify_email: boolean;
    staff_note_json: VersionStaffNote[];
    submission_json: unknown;
    created_date: string;
}

export interface VersionComment {
    id: number;
    text: string;
    component_id: string;
    submission_date: string | null;
}

export interface VersionStaffNote {
    id: number;
    note: string;
    note_type: string;
}

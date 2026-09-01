// Why an engagement's report is being withheld from the public.
export const UNAVAILABLE_REASON = {
    SEND_REPORT_OFF: 'send_report_off',
    ENGAGEMENT_UNPUBLISHED: 'engagement_unpublished',
    // The API withheld the report without a reason this build recognises.
    UNKNOWN: 'unknown',
} as const;

export type UnavailableReason = (typeof UNAVAILABLE_REASON)[keyof typeof UNAVAILABLE_REASON];

const KNOWN_REASONS: string[] = [UNAVAILABLE_REASON.SEND_REPORT_OFF, UNAVAILABLE_REASON.ENGAGEMENT_UNPUBLISHED];

/**
 * Read the reason out of the API's refusal. Anything unrecognised still counts as withheld
 */
export const toUnavailableReason = (responseBody: unknown): UnavailableReason => {
    const reason = (responseBody as { reason?: string } | undefined)?.reason;
    return reason && KNOWN_REASONS.includes(reason) ? (reason as UnavailableReason) : UNAVAILABLE_REASON.UNKNOWN;
};

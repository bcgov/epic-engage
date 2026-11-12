import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmailPreview from 'components/admin/comments/admin/CommentReview/emailPreview/EmailPreview';
import ProviderShell from '../ProviderShell';
import { createDefaultSurvey } from 'models/survey';
import { openEngagement } from '../factory';

describe('EmailPreview', () => {
    test('shows the engagement end date as stored, without a timezone shift', () => {
        // end_date is a date-only Pacific Time calendar date from the API (EngagementSchema fields.Date).
        // Parsing it as UTC midnight and converting to Pacific showed the previous day (ENGAGE-339).
        const survey = {
            ...createDefaultSurvey(),
            engagement: { ...openEngagement, end_date: '2026-11-09' },
        };

        render(
            <ProviderShell>
                <EmailPreview survey={survey}>
                    <div />
                </EmailPreview>
            </ProviderShell>,
        );

        expect(screen.getByText(/comment period is open until/)).toHaveTextContent('Nov 09 2026');
        expect(screen.getByText(/comment period is open until/)).not.toHaveTextContent('Nov 08 2026');
    });

    test('shows no date when the engagement has no end date', () => {
        const survey = {
            ...createDefaultSurvey(),
            engagement: { ...openEngagement, end_date: '' },
        };

        render(
            <ProviderShell>
                <EmailPreview survey={survey}>
                    <div />
                </EmailPreview>
            </ProviderShell>,
        );

        expect(screen.getByText(/comment period is open until/)).toHaveTextContent(/open until \. You must re-submit/);
    });
});

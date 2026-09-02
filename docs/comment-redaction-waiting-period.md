# Comment redaction waiting period

The `COMMENT_REDACT` cron job overwrites rejected public comments with
`[Comment Redacted]`. It is an `UPDATE`; the original text cannot be recovered.

## The value

**`N_DAYS = 14`** — fourteen days after the engagement's end date. Confirmed with
the owner of the privacy requirement on 2026-09-01; changing it needs their
agreement and an update here.

The window lets a rejection made in error be reversed while the text still
exists — two weeks covers a reviewer's absence or a late complaint — while not
retaining rejected content indefinitely.

## Effective delay

Roughly **14 to 15 days after the end date**. The clock runs from `end_date`, not
from when the engagement was marked closed — closed status is a gate, not the
start of the countdown. Closeout runs daily at 17:00 UTC, so the gate is met
around day 1; redaction runs daily at 00:00 UTC. The extra day comes from
comparing a naive Pacific `end_date` against a date derived from `utcnow()`.

## Copies in the reporting database

**Decision: the analytics copies must be erased too**, confirmed 2026-09-01.
Implemented — the job now redacts both databases in one run.

`user_feedback.comment` is the only analytics table holding raw comment text. The
ETL copies only `Approved` comments and selects on `submission_date`, which a
review decision does not change, so a comment approved first and rejected later
kept a readable copy there indefinitely. Free-text answers are not duplicated
elsewhere — `_extract_submission` skips textarea and text field components.

`CommentRedactService._redact_analytics_user_feedback` runs last in the same
`session_scope`, under the same fourteen-day gate, matching rows on
`source_comment_id` (the MET comment id, set by the ETL) through the existing
`met_db_analytics` bind.

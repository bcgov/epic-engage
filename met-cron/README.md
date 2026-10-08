# MET-CRON Job Scheduler

Python job scheduler application for The Modern Engagement Tool project.

## Getting Started

### Development Environment
* Install the following:
    - [Python](https://www.python.org/)
* Install Dependencies
    - Run `make setup` in the root of the project (met-api)

## Environment Variables

The development scripts for this application allow customization via an environment file in the root directory called `.env`. See an example of the environment variables that can be overridden in `sample.env`.

## Commands

### Development

The following commands support various development scenarios and needs.
Before running the following commands run `. venv/bin/activate` to enter into the virtual env.

> `make run`
>
> Runs the python application.  

> `make test`
>
> Runs the application unit tests<br>

> `make db`
>
> Runs the application database migrations.

> `make lint`
>
> Lints the application code.


To run met-cron functionality on your local machine execute the python commands located in the run files of this directory.
For example the `run_met_publish.sh` file contains the command to publish a scheduled engagement 

>`python3 invoke_jobs.py ENGAGEMENT_PUBLISH` 

`run_met_demi_backfill.sh` runs a manual job. It has no crontab entry and only runs when someone starts it.
It loads existing engagements into DEMI and writes only to DEMI, never to Eagle. It sends every engagement that has
an EPIC project id and is published, scheduled or closed, through the same path the publish job uses. Unpublished
engagements that were already pushed (they have a tracking id) are sent too, so DEMI shows them as unpublished.
Drafts are skipped. Engagements linked to a project notification are skipped and counted as `skipped_notification`.

The job refuses to start, and the run is marked failed, unless `IS_EAO_ENVIRONMENT` is true and `EPIC_SYNC_TARGET`
is `both` or `demi`. Each failed push is logged with its engagement id. A failed push does not stop the run. At the
end the log shows how many engagements were selected, pushed, failed and skipped, with the failed ids, and the run is
marked failed if any push failed.

The backfill, publish and close-out jobs share one lock, so only one of them runs at a time:

- If a publish or close-out run holds the lock, the backfill exits with status 1 without running. Start it again later.
- While the backfill holds the lock, each publish run is skipped (exit 0) and runs again 5 minutes later.
- Close-out waits up to 10 minutes for the lock, then gives up for the day. So run the backfill well clear of the
  17:00 UTC close-out.

Run it from the met-cron pod with `./run_met_demi_backfill.sh`. The direct command below skips the lock, so use it
only when no publish or close-out run can start:

>`python3 invoke_jobs.py ENGAGEMENT_DEMI_BACKFILL`

If close-out gives up waiting, its log line starts with `skip invoke_jobs.py ENGAGEMENT_CLOSEOUT`. Rerun it by hand
from the met-cron pod with `./run_met_closeout.sh`.

## Runbook: scheduled job monitoring

### Where the history lives

Every run of `invoke_jobs.py` writes a row to the `job_run_log` table in the **MET Analytics
database**. Container logs are lost on restart, this table is not.

| Column | Meaning |
| --- | --- |
| `job_name` | The job argument, e.g. `COMMENT_REDACT` |
| `started_at` / `finished_at` | UTC timestamps |
| `duration_seconds` | Wall clock time of the run |
| `success` | `true` succeeded, `false` raised, **`null` never reported back** |
| `error_type` / `error_detail` | Exception class and redacted traceback |

The row is committed *before* the job runs, so a killed process or an evicted pod leaves a
row with `success = null`. Those are as important as failures: the job started and vanished.

Did the closing job run this morning?

```sql
SELECT job_name, started_at, finished_at, duration_seconds, success
FROM job_run_log
WHERE job_name = 'CLOSING_SOON_EMAIL' AND started_at > now() - interval '2 days'
ORDER BY started_at DESC;
```

Anything that failed or never finished in the last day:

```sql
SELECT job_name, started_at, error_type, error_detail
FROM job_run_log
WHERE started_at > now() - interval '1 day' AND success IS DISTINCT FROM true
ORDER BY started_at DESC;
```

### Who is watching

Nothing pushes a notification today. A failure is visible in two places: the container log
for the run, and a `job_run_log` row with `success = false`. **Somebody has to look.** Run
the failure query above as part of the daily check, or wire it into whatever dashboard or
monitoring tool the team lands on.

Alerting was deliberately left out: GC Notify is being retired and the replacement tool is
not chosen yet. `job_run_log` is the data source that any alerting will read from, so
adding it later does not change anything here.

### What to do when a job has failed

1. Confirm the scope. Run the failure query above. One job failing once is different from
   every job failing, which usually means the database is down.
2. Read `error_type` and `error_detail` on the row. The traceback is redacted, not
   truncated to uselessness: it keeps the call site and the exception message.
3. Rerun the job by hand from the met-cron pod, e.g. `./run_met_comment_redact.sh`. The jobs
   are safe to rerun, each one reselects its own work. A clean rerun writes a `success = true`
   row and closes the incident.
4. If the rerun fails the same way, escalate to the EPIC development team with the
   `job_run_log.id` of the failed run.
5. A job that looks stalled with no failure row: check for `success IS NULL` rows. That is a
   killed process, not an application error.

### Configuration

Environment variables, set per environment in the deployment secret and never committed.
See `sample.env` for the names.

| Variable | Purpose |
| --- | --- |
| `JOB_LOG_ERROR_MAX_CHARS` | Cap on the traceback stored in `job_run_log.error_detail`, default 4000 |

### Participant data

Logs must never carry participant email addresses, submission ids, or comment text.
Exception text is passed through `met_cron.utils.scrub.scrub_sensitive`, which strips email
addresses and drops the `[SQL: ...]` parameter dump SQLAlchemy appends to database
errors. When adding a log line to a job, log counts, not rows.

Logging never blocks a job: a failure to write a row is caught and downgraded to a warning,
so a database outage cannot stop the work from running.

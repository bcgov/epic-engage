#! /bin/sh
# Manual job. Takes the publish job's flock(1) lock, so a backfill and a publish run never push at the same time
LOCK_FILE=/tmp/met-cron-engagement-publish.lock

exec 9>"$LOCK_FILE" || exit 1
if ! flock -n 9; then
  echo 'skip invoke_jobs.py ENGAGEMENT_DEMI_BACKFILL: publish, close-out or another backfill still in progress'
  exit 1
fi

echo 'run invoke_jobs.py ENGAGEMENT_DEMI_BACKFILL'
python3 invoke_jobs.py ENGAGEMENT_DEMI_BACKFILL

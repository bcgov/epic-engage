#! /bin/sh
# Shares the publish job's flock(1) lock so close-out, publish and the DEMI backfill never push at the same time.
# Waits instead of skipping: close-out runs once a day, publish every 5 minutes.
LOCK_FILE=/tmp/met-cron-engagement-publish.lock

exec 9>"$LOCK_FILE" || exit 1
if ! flock -w 600 9; then
  echo 'skip invoke_jobs.py ENGAGEMENT_CLOSEOUT: publish job or DEMI backfill held the lock for 10 minutes'
  exit 1
fi

echo 'run invoke_jobs.py ENGAGEMENT_CLOSEOUT'
python3 invoke_jobs.py ENGAGEMENT_CLOSEOUT

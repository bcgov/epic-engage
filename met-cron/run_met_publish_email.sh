#! /bin/sh
# Serialise runs using flock(1) to avoid double-sending emails
LOCK_FILE=/tmp/met-cron-publish-email.lock

exec 9>"$LOCK_FILE" || exit 1
if ! flock -n 9; then
  echo 'skip invoke_jobs.py PUBLISH_EMAIL: previous run still in progress'
  exit 0
fi

echo 'run invoke_jobs.py PUBLISH_EMAIL'
python3 invoke_jobs.py PUBLISH_EMAIL

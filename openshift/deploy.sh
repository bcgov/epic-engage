oc project $2-tools

# Promote images from dev to target environment
# Usage: ./deploy.sh <target-env> <project-prefix>
# Example: ./deploy.sh test e903c2
SOURCE_TAG="${SOURCE_TAG:-dev}"

# Create backup tags for production deployments
if [ "$1" == "prod" ]; then
  echo "Creating backup tags before production deployment..."
  BACKUP_TAG="prod-backup-$(date +%Y%m%d-%H%M%S)"
  
  oc tag met-api:prod met-api:$BACKUP_TAG
  oc tag notify-api:prod notify-api:$BACKUP_TAG
  oc tag analytics-api:prod analytics-api:$BACKUP_TAG
  oc tag met-cron:prod met-cron:$BACKUP_TAG
  oc tag met-web:prod met-web:$BACKUP_TAG
  oc tag met-analytics:prod met-analytics:$BACKUP_TAG
  oc tag dagster-etl:prod dagster-etl:$BACKUP_TAG
  
  echo "Backup created with tag: $BACKUP_TAG"
fi

# Promote images to target environment
oc tag met-api:$SOURCE_TAG met-api:$1
oc tag notify-api:$SOURCE_TAG notify-api:$1
oc tag analytics-api:$SOURCE_TAG analytics-api:$1
oc tag met-cron:$SOURCE_TAG met-cron:$1
oc tag met-web:$SOURCE_TAG met-web:$1
oc tag met-analytics:$SOURCE_TAG met-analytics:$1
oc tag dagster-etl:$SOURCE_TAG dagster-etl:$1

oc rollout status dc/met-api -n $2-$1 -w
oc rollout status dc/met-web -n $2-$1 -w

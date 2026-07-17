# ENGAGE dashboard data migration

## Run the ETL job

1. Point `DAGSTER_HOME` at a writable directory:

   ```sh
   export DAGSTER_HOME=/tmp/dagster_home && mkdir -p $DAGSTER_HOME
   ```

2. Run from the directory containing `repo.py`:

   ```sh
   cd /etl_project/services && dagster job execute -f repo.py -j met_data_ingestion
   ```

3. Entities process in order (user, engagement, survey, report setting, submission, email verification). Success ends with `RUN_SUCCESS`.

## Force a re-extract (survey only)

1. Mark run cycles unsuccessful in the **analytics** database:

   ```sql
   UPDATE etl_runcycle SET success = false WHERE packagename = 'survey' AND success = true;
   ```

2. Run `met_data_ingestion` (see above).

> **Warning:** only `survey` is safe to replay — its loader deactivates old rows and remaps responses. `submission` and `email_verification` are insert-only: replaying them duplicates `response_type_option` and `user_response_details` rows and doubles every dashboard number.

### Undo an accidental submission replay

1. Find the replay's runcycle id (`packagename = 'submission'`, recent `startdatetime`):

   ```sql
   SELECT id, packagename, startdatetime FROM etl_runcycle ORDER BY id DESC LIMIT 10;
   ```

2. Delete the duplicate pass (replace the id):

   ```sql
   DELETE FROM response_type_option WHERE runcycle_id = <replay_runcycle_id>;
   ```

   ```sql
   DELETE FROM user_response_details WHERE runcycle_id = <replay_runcycle_id>;
   ```

Leave `engagement`, `user_details`, `email_verification`, and `etl_runcycle` alone.

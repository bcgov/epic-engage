# Local Setup
A guide for developers.

## Pre Reqs
Install 
- [Node.js 16.x](https://nodejs.org/en/)
- [Python 3.8](https://www.python.org/)
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## met-api

Create a `.env` file based on `met-api/sample.env`

### Install Dependencies

In the root of the `met-api` project run
```
make setup
```

### Set up the Databases
#### Option 1 (Docker):

1. Run `docker-compose up` in the root of the met-api project

This will start 4 containers:
- postgres met db
- postgres met test db
- postgres analytics db
- keycloak

2. Update .env if needed with port.


#### Option 2 (Local):
1. Install PostgreSQL
2. Create a db:
```
createdb -h localhost -U postgres -p 5432 app
```
3. Update .env if needed with port.


### Populating Data:
#### Docker
1. Get the postgres db backup dump from current `dev` in OpenShift.
2. Connect to the docker postgres db
```bash
psql -h localhost -p <DOCKER_POSTGRES_PORT> -U admin
```
3. Create the required roles:
```sql
CREATE ROLE postgres WITH
  LOGIN
  PASSWORD 'postgres'
  SUPERUSER
  CREATEDB
  CREATEROLE
  REPLICATION
  BYPASSRLS;
CREATE ROLE met;
```
4. Restore the db dump
```bash
pg_restore -h localhost -U postgres -p <DOCKER_POSTGRES_PORT> -d postgres -v <DEV_DB_BACKUP.DUMP>
```
5. Connect to the db and set the search path
```bash
psql -h localhost -p <DOCKER_POSTGRES_PORT> -U postgres -d postgres
```
```sql
SET search_path TO met;
```
You should now be able to query the table with the restored data.

#### Local
1. Get the postgres db backup dump from current `dev` in OpenShift.
2. Restore the db dump
```bash
pg_restore -h localhost -U postgres -p <POSTGRES_PORT> -d app -v <DEV_DB_BACKUP.DUMP>
```
3. Connect to the db and set the search path
```bash
psql -h localhost -p <POSTGRES_PORT> -U postgres -d app
```
```sql
SET search_path TO met;
```
You should now be able to query the table with the restored data.

### Starting the app
In the root of the `met-api` project run
```
make run
```

### Running the unit test

```
make test
```

## met-web

Create a `.env` file based on `met-web/sample.env`

Installing the packages:

```
npm install
```

Starting the app:

```
npm start
```
\* met-api must be running concurrently

Running the unit test:

```
npm run test
```

## met-cron
Create a `.env` file based on `met-cron/sample.env`

Installing the packages:

```
make setup
```

This is a task scheduler project, to run tasks manually use the following commands:

```
make run_closeout
```
```
make run_publish
```

## met-etl
Create a .env file based on met-etl/sample.env

Running the app:

```
docker compose up
```

## notify-api
Create a `.env` file based on `notify-api/sample.env`

Installing the packages:

```
make setup
```

Starting the app:

```
make run
```

Running the unit test:

```
make test
```

## analytics-api
Create a `.env` file based on `analytics-api/sample.env`.
Follow similar steps for met-api setup to populate anaytlics db if needed.

## redash

A custom redash project is used for some of the dashboards within MET.

If needed, to start an instance clone the following repository:
```
git clone https://github.com/bcgov/redash
```

create a .env file with the following:
```
REDASH_COOKIE_SECRET=redash
```

Run the docker compose command:
```
docker compose up
```
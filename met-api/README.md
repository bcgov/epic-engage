# MET-API

Python flask API application for The Modern Engagement Tool project.

## Getting Started

### Development Environment
* Install the following:
    - [Python](https://www.python.org/)3.12
    - [Docker](https://www.docker.com/)
    - [Docker-Compose](https://docs.docker.com/compose/install/)
* Install Dependencies
    - Run `make setup` in the root of the project (met-api)
* Start the databases
    - Run `docker-compose up` in the root of the project (met-api)

## Environment Variables

The development scripts for this application allow customization via an environment file in the root directory called `.env`. See an example of the environment variables that can be overridden in `sample.env`.

## Commands

### Development

The following commands support various development scenarios and needs.
Before running the following commands run `. venv/bin/activate` to enter into the virtual env.


> `make run`
>
> Runs the python application and runs database migrations.  
Open [http://localhost:5000/api](http://localhost:5000/api) to view it in the browser.<br/>
> The page will reload if you make edits.<br/>
> You will also see any lint errors in the console.

> `make test`
>
> Runs the application unit tests<br>

> `make lint`
>
> Lints the application code.

## Analytics

### Server-Side Analytics with Snowplow

This API includes **server-side analytics tracking** using Snowplow, designed with a provider-agnostic architecture for future extensibility. Currently, Snowplow is the only implemented provider, tracking user interactions server-side to bypass ad blockers.

**Quick Start:**
```python
from met_api.utils import analytics

# Track a survey submission
analytics.track_survey_submission(
    survey_id=123,
    engagement_id=456,
    submission_id=789
)
```

**Configuration** (add to `.env`):
```bash
# Enable analytics
ANALYTICS_ENABLED=true

# Snowplow configuration
SNOWPLOW_ENABLED=true
SNOWPLOW_COLLECTOR=spt.apps.gov.bc.ca
SNOWPLOW_APP_ID=Snowplow_standalone_MET
SNOWPLOW_NAMESPACE=met-api
```

**Documentation:** See [docs/ANALYTICS.md](docs/ANALYTICS.md) for complete guide including usage examples, integration patterns, deployment checklist, and troubleshooting.

## Debugging in the Editor

### Visual Studio Code

Ensure the latest version of [VS Code](https://code.visualstudio.com) is installed.

The [`launch.json`](.vscode/launch.json) is already configured with a launch task (MET-API Launch) that allows you to launch chrome in a debugging capacity and debug through code within the editor. 
from flask_migrate import Migrate
from flask.cli import FlaskGroup

import invoke_jobs
from met_cron.models import db

# Create the app in migration mode
app = invoke_jobs.create_app(run_mode='migration')
migrate = Migrate(app, db)

# Create a Flask CLI group so `flask` commands work
cli = FlaskGroup(app)

if __name__ == '__main__':
    cli()

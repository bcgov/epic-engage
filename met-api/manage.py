from flask_migrate import Migrate
from met_api import create_app, db

app = create_app()
migrate = Migrate(app, db)


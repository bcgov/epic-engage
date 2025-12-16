from flask_migrate import Migrate
from analytics_api import create_app, db

app = create_app()
migrate = Migrate(app, db)

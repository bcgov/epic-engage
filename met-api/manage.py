from flask_migrate import Migrate
from met_api import create_app, db

app = create_app()
migrate = Migrate(app, db)

# Only needed if you want to expose extra custom commands
# Otherwise, you can run Flask CLI commands directly
if __name__ == "__main__":
    app.run()

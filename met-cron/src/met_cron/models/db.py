"""Initializations for db, migration and marshmallow."""

from contextlib import contextmanager
from flask import current_app
from flask_marshmallow import Marshmallow
from flask_migrate import Migrate

from met_api.models import db

# Migrate initialize in __init__ file
# Migrate database config
migrate = Migrate()

# Marshmallow for database model schema
ma = Marshmallow()

# Migrate initialize
migrate = Migrate()

@contextmanager
def session_scope():
    """Provide a transactional scope around a series of operations."""
    # Using the default session for the scope
    session = db.session
    try:
        yield session
        session.commit()
    except Exception as e:  # noqa: B901, E722
        current_app.logger.error(f'Error in session_scope: {e}')
        session.rollback()
        raise
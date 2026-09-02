"""user_feedback model class.

Mirrors the analytics database's user_feedback table, limited to the columns the
redaction job needs. BaseModel binds it to met_db_analytics, so queries through
this model go to the analytics database rather than the MET one.

The real definition lives in analytics-api; the foreign key it declares on
survey_id is deliberately left off here, because met-api's own survey table is
registered in the same SQLAlchemy metadata and belongs to the other database.
"""

from .base_model import BaseModel
from .db import db


class UserFeedback(BaseModel):  # pylint: disable=too-few-public-methods
    """Definition of the User Feedback entity in the analytics database."""

    __tablename__ = 'user_feedback'

    id = db.Column(db.Integer, primary_key=True, nullable=False, autoincrement=True)
    survey_id = db.Column(db.Integer, primary_key=True, nullable=False)
    user_id = db.Column(db.Integer)
    comment = db.Column(db.Text())
    sentiment_analysis = db.Column(db.String(100))
    label = db.Column(db.String(100))
    source_comment_id = db.Column(db.Integer)

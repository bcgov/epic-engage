"""Engagement Visibility model class.

Manages the engagement visibility
"""
from .base_model import BaseModel
from .db import db, ma


class EngagementVisibility(BaseModel):  # pylint: disable=too-few-public-methods
    """Definition of the Engagement Visibility entity."""

    __tablename__ = 'engagement_visibility'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    visibility_name = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(50))
    created_date = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())
    updated_date = db.Column(db.DateTime, nullable=True)


class EngagementVisibilitySchema(ma.Schema):
    """Engagement visibility schema."""

    class Meta:  # pylint: disable=too-few-public-methods
        """Meta class."""

        fields = ('id', 'visibility_name', 'description', 'created_date', 'updated_date')

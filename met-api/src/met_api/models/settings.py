"""Tenant Setting model class.

Manages tenant-specific settings for multi-tenant application
"""

from __future__ import annotations

from enum import Enum

from .base_model import BaseModel
from .db import db


class SettingKeyEnum(Enum):
    """Enumeration of possible setting keys."""

    THREAT_CONTACT = 'threat_contact'


class Settings(BaseModel):
    """Definition of the Settings entity."""

    __tablename__ = 'settings'

    # Primary key
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    # Foreign keys
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id'), nullable=False)

    # Setting details
    setting_key = db.Column(db.String(255), nullable=False)
    setting_value = db.Column(db.Text, nullable=True)
    setting_value_type = db.Column(db.String(50), nullable=False, default='string')

    @classmethod
    def get_all_settings(cls):
        """Get all settings for the current tenant."""
        query = db.session.query(Settings)
        query = cls._add_tenant_filter(query)
        settings = query.all()
        return settings

    @classmethod
    def get_settings_by_key(cls, setting_key: str):
        """Get a specific setting for the current tenant."""
        query = db.session.query(Settings).filter_by(setting_key=setting_key)
        query = cls._add_tenant_filter(query)
        return query.first()

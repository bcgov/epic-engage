"""ThreatContact model class.

Manages the ThreatContact
"""
from __future__ import annotations

from datetime import datetime, timezone

from .base_model import BaseModel
from .db import db


class ThreatContact(BaseModel):  # pylint: disable=too-few-public-methods
    """Definition of the ThreatContact entity."""

    __tablename__ = 'threat_contact'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    first_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50))
    email = db.Column(db.String(50))
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id'), nullable=True)

    @classmethod
    def get_threat_contacts(cls) -> list[ThreatContact]:
        """Get ThreatContacts."""
        query = db.session.query(ThreatContact)
        query = cls._add_tenant_filter(query)
        return query.order_by(ThreatContact.first_name, ThreatContact.last_name).all()

    @classmethod
    def create_threat_contact(cls, contact) -> ThreatContact:
        """Create ThreatContact."""
        new_threat_contact = ThreatContact(
            first_name=contact.get('first_name', None),
            last_name=contact.get('last_name', None),
            email=contact.get('email', None),
            tenant_id=contact.get('tenant_id', None),
            created_date=datetime.now(timezone.utc),
            updated_date=datetime.now(timezone.utc),
            created_by=contact.get('created_by', None),
            updated_by=contact.get('updated_by', None),
        )
        new_threat_contact.save()

        return new_threat_contact


"""Service for threat contact management."""
from met_api.models.threat_contact import ThreatContact
from met_api.schemas.threat_contact import ThreatContactSchema


class ThreatContactService:
    """ThreatContact management service."""

    def get_threat_contact_by_id(self, threat_contact_id):
        """Get contact by id."""
        threat_contact_record = ThreatContact.find_by_id(threat_contact_id)
        threat_contact = ThreatContactSchema().dump(threat_contact_record)
        return threat_contact

    def get_threat_contacts(self):
        """Get threat contacts."""
        threat_contacts_records = ThreatContact.get_threat_contacts()
        threat_contacts = ThreatContactSchema(many=True).dump(threat_contacts_records)
        return threat_contacts

    @staticmethod
    def create_threat_contact(threat_contact_data):
        """Create ThreatContact."""
        return ThreatContact.create_threat_contact(threat_contact_data)

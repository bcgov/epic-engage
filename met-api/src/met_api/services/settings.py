"""Settings service for managing tenant settings."""

from typing import List
from ..models.settings import Settings


class SettingsService:
    """Service class for Settings CRUD operations."""

    @staticmethod
    def create_setting(setting_data: dict) -> Settings:
        """Create a new setting for a tenant."""
        setting = Settings(
            setting_key=setting_data.get('setting_key'),
            setting_value=str(setting_data.get('setting_value')),
            setting_value_type=setting_data.get('setting_value_type', 'string')
        )
        setting.save()
        return setting

    @classmethod
    def get_settings(cls) -> List[Settings]:
        """Get all settings for a specific tenant."""
        settings = Settings.get_all_settings()
        return settings

    @classmethod
    def get_setting_by_key(cls, setting_key: str) -> Settings:
        """Get a specific setting by key for a tenant."""
        setting = Settings.get_settings_by_key(setting_key)
        return setting

    @staticmethod
    def update_setting(setting_id: int, setting_data: dict) -> Settings:
        """Update a specific setting by ID for a tenant."""
        setting = Settings.find_by_id(setting_id)
        if not setting:
            raise KeyError(f'Setting with ID {setting_id} not found.')

        setting.setting_value = setting_data.get('setting_value', setting.setting_value)

        setting.save()
        return setting

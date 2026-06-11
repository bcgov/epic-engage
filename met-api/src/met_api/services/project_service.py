"""Service for project management."""
from http import HTTPStatus
import logging

from flask import current_app

from met_api.constants.engagement_status import Status
from met_api.models.engagement import Engagement as EngagementModel
from met_api.models.engagement_metadata import EngagementMetadataModel
from met_api.services.email_verification_service import EmailVerificationService
from met_api.services.object_storage_service import ObjectStorageService
from met_api.services.rest_service import RestService
from met_api.utils import notification
from met_api.utils.datetime import convert_and_format_to_utc_str

# Statuses where the engagement should not be publicly visible in EPIC.
_NON_PUBLIC_STATUSES = {Status.Draft.value, Status.Scheduled.value, Status.Unpublished.value}


class ProjectService:
    """Project management service."""

    @staticmethod
    def update_project_info(eng_id: str) -> None:
        """Create or update a CommentPeriod in the EPIC/EAO system for the given engagement."""
        logger = logging.getLogger(__name__)

        try:
            is_eao_environment = current_app.config.get('IS_EAO_ENVIRONMENT')
            if not is_eao_environment:
                return

            engagement_metadata: EngagementMetadataModel
            engagement, engagement_metadata = ProjectService._get_engagement_and_metadata(eng_id)

            if not engagement_metadata or not (project_id := engagement_metadata.project_id):
                # EPIC is not interested in the data without project Id. Skip.
                return

            epic_comment_period_payload = ProjectService._construct_epic_payload(engagement, project_id)
            eao_service_account_token = ProjectService._get_eao_service_account_token()

            if engagement_metadata.project_tracking_id:
                update_url = f'{current_app.config.get("EPIC_URL")}/{engagement_metadata.project_tracking_id}'
                RestService.put(endpoint=update_url, token=eao_service_account_token,
                                data=epic_comment_period_payload, raise_for_status=False)

            else:
                create_url = current_app.config.get('EPIC_URL')
                api_response = RestService.post(endpoint=create_url, token=eao_service_account_token,
                                                data=epic_comment_period_payload, raise_for_status=False)

                if api_response.status_code == HTTPStatus.OK:
                    response_data = api_response.json()
                    # Eagle-API returns the created MongoDB document; the PK field is '_id'.
                    tracking_number = str(response_data.get('_id', ''))
                    if tracking_number:
                        engagement_metadata.project_tracking_id = tracking_number
                        engagement_metadata.commit()

        except Exception as e:  # NOQA # pylint:disable=broad-except
            logger.error('Error in update_project_info: %s', str(e))

    @staticmethod
    def delete_from_epic(eng_id: str) -> None:
        """Delete the CommentPeriod in EPIC that corresponds to the given engagement."""
        logger = logging.getLogger(__name__)

        try:
            is_eao_environment = current_app.config.get('IS_EAO_ENVIRONMENT')
            if not is_eao_environment:
                return

            engagement_metadata = EngagementMetadataModel.find_by_engagement_id(eng_id)
            if not (engagement_metadata and engagement_metadata.project_tracking_id):
                return

            eao_service_account_token = ProjectService._get_eao_service_account_token()
            delete_url = f'{current_app.config.get("EPIC_URL")}/{engagement_metadata.project_tracking_id}'
            RestService.delete(endpoint=delete_url, token=eao_service_account_token, raise_for_status=False)

        except Exception as e:  # NOQA # pylint:disable=broad-except
            logger.error('Error in delete_from_epic: %s', str(e))

    @staticmethod
    def _get_engagement_and_metadata(eng_id: str):
        engagement = EngagementModel.find_by_id(eng_id)
        engagement_metadata = EngagementMetadataModel.find_by_engagement_id(eng_id)
        return engagement, engagement_metadata

    @staticmethod
    def _construct_epic_payload(engagement, project_id):
        site_url = notification.get_tenant_site_url(engagement.tenant_id)
        # Dates converted to UTC — EPIC accepts UTC and converts to PST for display.
        start_date_utc = convert_and_format_to_utc_str(engagement.start_date)
        end_date_utc = convert_and_format_to_utc_str(engagement.end_date)
        # Only mark the CP as published when the engagement itself is publicly visible.
        is_published = engagement.status_id not in _NON_PUBLIC_STATUSES

        banner_image_url = ObjectStorageService().get_url(engagement.banner_filename)

        return {
            'isMet': True,
            'metURL': f'{site_url}{EmailVerificationService.get_engagement_path(engagement, is_public_url=True)}',
            'metURLAdmin': f'{site_url}{EmailVerificationService.get_engagement_path(engagement, is_public_url=False)}',
            'metBannerImageUrl': banner_image_url,
            'dateCompleted': end_date_utc,
            'dateStarted': start_date_utc,
            'instructions': '',
            'commentTip': '',
            'milestone': current_app.config.get('EPIC_MILESTONE'),
            'openHouse': '',
            'relatedDocuments': '',
            'project': project_id,
            'isPublished': is_published,
        }

    @staticmethod
    def _get_eao_service_account_token():
        kc_service_id = current_app.config.get('EPIC_KEYCLOAK_SERVICE_ACCOUNT_ID')
        kc_secret = current_app.config.get('EPIC_KEYCLOAK_SERVICE_ACCOUNT_SECRET')
        issuer_url = current_app.config.get('EPIC_JWT_OIDC_ISSUER')
        client_id = current_app.config.get('EPIC_KC_CLIENT_ID')
        return RestService.get_access_token_with_password(kc_service_id, kc_secret, client_id, issuer_url)
